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
	Title          *string
	Status         *string
	Kind           *string
	ProjectID      *uuid.UUID
	ClearProj      bool
	Urgent         *bool
	Important      *bool
	Pinned         *bool
	Stress         *int
	ClearStr       bool
	DueAt          *time.Time
	ClearDue       bool
	DevDueAt       *time.Time
	ClearDevDue    bool
	ReviewDueAt    *time.Time
	ClearReviewDue bool
	TestDueAt      *time.Time
	ClearTestDue   bool
	Description    *string
	PlannedSeconds *int
	Links          *[]domain.ProjectLink
	PersonIDs      *[]uuid.UUID
	ExternalKey    *string
	Archived       *bool
}

func (s *Service) ListItems(ctx context.Context, filter domain.ItemFilter) ([]domain.Item, error) {
	return s.Items.List(ctx, filter)
}

func (s *Service) GetItem(ctx context.Context, id uuid.UUID) (domain.Item, error) {
	return s.Items.Get(ctx, id)
}

func (s *Service) CreateItem(ctx context.Context, title, kind string, projectID *uuid.UUID, urgent, important bool) (domain.Item, error) {
	parsedKind, err := domain.ParseItemKind(kind)
	if err != nil {
		parsedKind = domain.KindTask
		if strings.TrimSpace(kind) != "" {
			return domain.Item{}, err
		}
	}
	manual, err := s.Sources.Manual(ctx)
	if err != nil {
		return domain.Item{}, err
	}
	item, err := domain.NewLocalItem(manual.ID, title, parsedKind)
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
	if patch.Kind != nil {
		kind, err := domain.ParseItemKind(*patch.Kind)
		if err != nil {
			return domain.Item{}, err
		}
		item.Kind = kind
	}
	if patch.Status != nil {
		status, err := domain.ParseItemStatusForKind(*patch.Status, item.Kind)
		if err != nil {
			return domain.Item{}, err
		}
		item.Status = status
	} else if !domain.StatusAllowed(item.Kind, item.Status) {
		return domain.Item{}, fmt.Errorf("%w: item status", domain.ErrInvalid)
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
	if patch.Pinned != nil {
		item.Pinned = *patch.Pinned
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
	if patch.ClearDevDue {
		item.DevDueAt = nil
	} else if patch.DevDueAt != nil {
		item.DevDueAt = patch.DevDueAt
	}
	if patch.ClearReviewDue {
		item.ReviewDueAt = nil
	} else if patch.ReviewDueAt != nil {
		item.ReviewDueAt = patch.ReviewDueAt
	}
	if patch.ClearTestDue {
		item.TestDueAt = nil
	} else if patch.TestDueAt != nil {
		item.TestDueAt = patch.TestDueAt
	}
	if patch.Description != nil {
		item.Description = strings.TrimSpace(*patch.Description)
	}
	if patch.PlannedSeconds != nil {
		if err := item.SetPlannedSeconds(*patch.PlannedSeconds); err != nil {
			return domain.Item{}, err
		}
	}
	if patch.Links != nil {
		item.Links, err = domain.NormalizeLinks(*patch.Links)
		if err != nil {
			return domain.Item{}, err
		}
	}
	if patch.PersonIDs != nil {
		item.PersonIDs = domain.NormalizeIDs(*patch.PersonIDs)
	}
	if patch.ExternalKey != nil {
		if item.SourceKind != domain.SourceManual {
			return domain.Item{}, fmt.Errorf("%w: external key", domain.ErrForbidden)
		}
		item.ExternalKey = strings.TrimSpace(*patch.ExternalKey)
	}
	now := s.now()
	if patch.Archived != nil {
		if *patch.Archived {
			item.Archive(now)
		} else {
			item.Restore(now)
		}
	}
	item.UpdatedAt = now
	return s.Items.Update(ctx, item)
}

func (s *Service) ListItemNotes(ctx context.Context, itemID uuid.UUID) ([]domain.ItemNote, error) {
	if _, err := s.Items.Get(ctx, itemID); err != nil {
		return nil, err
	}
	return s.ItemNotes.ListByItem(ctx, itemID)
}

func (s *Service) CreateItemNote(ctx context.Context, itemID uuid.UUID, body string) (domain.ItemNote, error) {
	if _, err := s.Items.Get(ctx, itemID); err != nil {
		return domain.ItemNote{}, err
	}
	note, err := domain.NewItemNote(itemID, body)
	if err != nil {
		return domain.ItemNote{}, err
	}
	return s.ItemNotes.Create(ctx, note)
}

func (s *Service) DeleteItemNote(ctx context.Context, itemID, noteID uuid.UUID) error {
	note, err := s.ItemNotes.Get(ctx, noteID)
	if err != nil {
		return err
	}
	if note.ItemID != itemID {
		return domain.ErrNotFound
	}
	return s.ItemNotes.Delete(ctx, noteID)
}

func (s *Service) DeleteItem(ctx context.Context, id uuid.UUID) error {
	if _, err := s.Items.Get(ctx, id); err != nil {
		return err
	}
	return domain.ErrForbidden
}
