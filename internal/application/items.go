package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/domain"
)

type ItemPatch struct {
	Title     *string
	Status    *string
	Kind      *string
	ProjectID *uuid.UUID
	ClearProj bool
	Urgent    *bool
	Important *bool
	Stress    *int
	ClearStr  bool
	DueAt     *time.Time
	ClearDue  bool
}

func (s *Service) ListItems(ctx context.Context, filter domain.ItemFilter) ([]domain.Item, error) {
	return s.Items.List(ctx, filter)
}

func (s *Service) CreateItem(ctx context.Context, title, kind string, projectID *uuid.UUID, urgent, important bool) (domain.Item, error) {
	parsedKind, err := domain.ParseItemKind(kind)
	if err != nil {
		parsedKind = domain.KindTask
		if strings.TrimSpace(kind) != "" {
			return domain.Item{}, err
		}
	}
	local, err := s.Sources.Local(ctx)
	if err != nil {
		return domain.Item{}, err
	}
	item, err := domain.NewLocalItem(local.ID, title, parsedKind)
	if err != nil {
		return domain.Item{}, err
	}
	item.ProjectID = projectID
	item.Urgent = urgent
	item.Important = important
	return s.Items.Create(ctx, item)
}

func (s *Service) PatchItem(ctx context.Context, id uuid.UUID, patch ItemPatch) (domain.Item, error) {
	item, err := s.Items.Get(ctx, id)
	if err != nil {
		return domain.Item{}, err
	}
	if patch.Title != nil {
		title := strings.TrimSpace(*patch.Title)
		if title == "" {
			return domain.Item{}, fmt.Errorf("%w: title", domain.ErrInvalid)
		}
		item.Title = title
	}
	if patch.Status != nil {
		status, err := domain.ParseItemStatus(*patch.Status)
		if err != nil {
			return domain.Item{}, err
		}
		item.Status = status
	}
	if patch.Kind != nil {
		kind, err := domain.ParseItemKind(*patch.Kind)
		if err != nil {
			return domain.Item{}, err
		}
		item.Kind = kind
	}
	if patch.ClearProj {
		item.ProjectID = nil
	} else if patch.ProjectID != nil {
		item.ProjectID = patch.ProjectID
	}
	if patch.Urgent != nil {
		item.Urgent = *patch.Urgent
	}
	if patch.Important != nil {
		item.Important = *patch.Important
	}
	if patch.ClearStr {
		item.Stress = nil
	} else if patch.Stress != nil {
		if err := domain.ValidateStress(*patch.Stress); err != nil {
			return domain.Item{}, err
		}
		item.Stress = patch.Stress
	}
	if patch.ClearDue {
		item.DueAt = nil
	} else if patch.DueAt != nil {
		item.DueAt = patch.DueAt
	}
	item.UpdatedAt = s.now()
	return s.Items.Update(ctx, item)
}

func (s *Service) DeleteItem(ctx context.Context, id uuid.UUID) error {
	item, err := s.Items.Get(ctx, id)
	if err != nil {
		return err
	}
	if item.ExternalKey != "" {
		return domain.ErrSourceReadOnly
	}
	return s.Items.Delete(ctx, id)
}
