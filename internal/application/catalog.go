package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/domain"
)

func (s *Service) ListProjects(ctx context.Context) ([]domain.Project, error) {
	return s.Projects.List(ctx)
}

func (s *Service) CreateProject(ctx context.Context, name, color string, target float64) (domain.Project, error) {
	project, err := domain.NewProject(name, color, target)
	if err != nil {
		return domain.Project{}, err
	}
	return s.Projects.Create(ctx, project)
}

func (s *Service) PatchProject(ctx context.Context, id uuid.UUID, name, color *string, target *float64) (domain.Project, error) {
	project, err := s.Projects.Get(ctx, id)
	if err != nil {
		return domain.Project{}, err
	}
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" {
			return domain.Project{}, fmt.Errorf("%w: project name", domain.ErrInvalid)
		}
		project.Name = trimmed
	}
	if color != nil && *color != "" {
		project.Color = *color
	}
	if target != nil {
		if *target < 0 {
			return domain.Project{}, fmt.Errorf("%w: target hours", domain.ErrInvalid)
		}
		project.TargetHoursWeek = *target
	}
	project.UpdatedAt = s.now()
	return s.Projects.Update(ctx, project)
}

func (s *Service) DeleteProject(ctx context.Context, id uuid.UUID) error {
	return s.Projects.Delete(ctx, id)
}

func (s *Service) ListNotes(ctx context.Context, itemID *uuid.UUID) ([]domain.Note, error) {
	return s.Notes.List(ctx, itemID)
}

func (s *Service) CreateNote(ctx context.Context, body string, itemID *uuid.UUID) (domain.Note, error) {
	note, err := domain.NewNote(body, itemID)
	if err != nil {
		return domain.Note{}, err
	}
	return s.Notes.Create(ctx, note)
}

func (s *Service) PatchNote(ctx context.Context, id uuid.UUID, body string) (domain.Note, error) {
	note, err := s.Notes.Get(ctx, id)
	if err != nil {
		return domain.Note{}, err
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return domain.Note{}, fmt.Errorf("%w: note body", domain.ErrInvalid)
	}
	note.Body = body
	note.UpdatedAt = s.now()
	return s.Notes.Update(ctx, note)
}

func (s *Service) DeleteNote(ctx context.Context, id uuid.UUID) error {
	return s.Notes.Delete(ctx, id)
}
