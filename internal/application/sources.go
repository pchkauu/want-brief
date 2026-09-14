package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/domain"
)

type SourceInput struct {
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	BaseURL string `json:"baseUrl"`
	Token   string `json:"token"`
	Query   string `json:"query"`
}

func (s *Service) ListSources(ctx context.Context) ([]domain.Source, error) {
	sources, err := s.Sources.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Source, 0, len(sources))
	for _, source := range sources {
		source.HasToken = source.TokenSealed != ""
		out = append(out, source.Public())
	}
	return out, nil
}

func (s *Service) CreateSource(ctx context.Context, in SourceInput) (domain.Source, error) {
	kind, err := domain.ParseSourceKind(in.Kind)
	if err != nil {
		return domain.Source{}, err
	}
	if kind == domain.SourceLocal {
		return domain.Source{}, fmt.Errorf("%w: local source is built-in", domain.ErrConflict)
	}
	source, err := domain.NewSource(kind, in.Name, in.BaseURL, in.Query)
	if err != nil {
		return domain.Source{}, err
	}
	if strings.TrimSpace(in.Token) != "" {
		sealed, err := s.Tokens.Seal(strings.TrimSpace(in.Token))
		if err != nil {
			return domain.Source{}, err
		}
		source.TokenSealed = sealed
	}
	created, err := s.Sources.Create(ctx, source)
	if err != nil {
		return domain.Source{}, err
	}
	created.HasToken = created.TokenSealed != ""
	return created.Public(), nil
}

func (s *Service) PatchSource(ctx context.Context, id uuid.UUID, in SourceInput) (domain.Source, error) {
	source, err := s.Sources.Get(ctx, id)
	if err != nil {
		return domain.Source{}, err
	}
	if source.Kind == domain.SourceLocal {
		return domain.Source{}, fmt.Errorf("%w: local source", domain.ErrForbidden)
	}
	if strings.TrimSpace(in.Name) != "" {
		source.Name = strings.TrimSpace(in.Name)
	}
	if in.BaseURL != "" {
		source.BaseURL = strings.TrimRight(strings.TrimSpace(in.BaseURL), "/")
	}
	if in.Query != "" {
		source.QueryFilter = in.Query
	}
	if strings.TrimSpace(in.Token) != "" {
		sealed, err := s.Tokens.Seal(strings.TrimSpace(in.Token))
		if err != nil {
			return domain.Source{}, err
		}
		source.TokenSealed = sealed
	}
	source.UpdatedAt = s.now()
	updated, err := s.Sources.Update(ctx, source)
	if err != nil {
		return domain.Source{}, err
	}
	updated.HasToken = updated.TokenSealed != ""
	return updated.Public(), nil
}

func (s *Service) DeleteSource(ctx context.Context, id uuid.UUID) error {
	source, err := s.Sources.Get(ctx, id)
	if err != nil {
		return err
	}
	if source.Kind == domain.SourceLocal {
		return fmt.Errorf("%w: local source", domain.ErrForbidden)
	}
	return s.Sources.Delete(ctx, id)
}

func (s *Service) SyncSource(ctx context.Context, id uuid.UUID) (int, error) {
	source, err := s.Sources.Get(ctx, id)
	if err != nil {
		return 0, err
	}
	if source.Kind == domain.SourceLocal {
		return 0, fmt.Errorf("%w: local source", domain.ErrForbidden)
	}
	puller, ok := s.Pullers[source.Kind]
	if !ok {
		return 0, domain.ErrUnsupported
	}
	if source.TokenSealed == "" {
		return 0, domain.ErrNoToken
	}
	token, err := s.Tokens.Open(source.TokenSealed)
	if err != nil {
		return 0, fmt.Errorf("open token: %w", err)
	}
	remote, err := puller.Pull(ctx, source, token)
	if err != nil {
		return 0, err
	}
	count := 0
	for _, remoteItem := range remote {
		item := domain.Item{
			SourceID:    source.ID,
			ExternalKey: remoteItem.ExternalKey,
			Title:       remoteItem.Title,
			Status:      remoteItem.Status,
			Kind:        domain.KindTask,
			Urgent:      remoteItem.HintUrgent,
			Important:   remoteItem.HintImportant,
			DueAt:       remoteItem.DueAt,
			UpdatedAt:   s.now(),
			CreatedAt:   s.now(),
		}
		if _, err := s.Items.UpsertSynced(ctx, item); err != nil {
			return count, err
		}
		count++
	}
	now := s.now()
	source.LastSyncAt = &now
	source.UpdatedAt = now
	if _, err := s.Sources.Update(ctx, source); err != nil {
		return count, err
	}
	return count, nil
}
