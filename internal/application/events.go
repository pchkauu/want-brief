package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/domain"
)

type EventWrite struct {
	Title             string
	Description       string
	Agenda            string
	Kind              string
	Type              string
	ProjectID         *uuid.UUID
	StartsAt          time.Time
	DurationSeconds   int
	Recurrence        string
	Links             []domain.ProjectLink
	MeetURL           string
	Involvement       *int
	ActiveStartOffset *int
	ActiveEndOffset   *int
	CanSkip           *bool
	People            *[]domain.PersonRel
}

func (s *Service) ListEventOccurrences(ctx context.Context, from, to time.Time) ([]domain.EventOccurrence, error) {
	series, err := s.Events.List(ctx)
	if err != nil {
		return nil, err
	}
	out := domain.ExpandEvents(series, from, to)
	if out == nil {
		return []domain.EventOccurrence{}, nil
	}
	return out, nil
}

func (s *Service) ListEvents(ctx context.Context) ([]domain.Event, error) {
	return s.Events.List(ctx)
}

func (s *Service) GetEvent(ctx context.Context, id uuid.UUID) (domain.Event, error) {
	return s.Events.Get(ctx, id)
}

func (s *Service) CreateEvent(ctx context.Context, write EventWrite) (domain.Event, error) {
	draft, err := draftFromWrite(write)
	if err != nil {
		return domain.Event{}, err
	}
	event, err := domain.NewEventFrom(draft)
	if err != nil {
		return domain.Event{}, err
	}
	if write.People != nil {
		people, nerr := domain.NormalizePersonRels(*write.People)
		if nerr != nil {
			return domain.Event{}, nerr
		}
		event.People = people
	} else {
		event.People = []domain.PersonRel{}
	}
	return s.Events.Create(ctx, event)
}

func (s *Service) ReplaceEvent(ctx context.Context, id uuid.UUID, write EventWrite) (domain.Event, error) {
	event, err := s.Events.Get(ctx, id)
	if err != nil {
		return domain.Event{}, err
	}
	draft, err := draftFromWrite(write)
	if err != nil {
		return domain.Event{}, err
	}
	if err := event.Apply(draft); err != nil {
		return domain.Event{}, err
	}
	if write.People != nil {
		people, nerr := domain.NormalizePersonRels(*write.People)
		if nerr != nil {
			return domain.Event{}, nerr
		}
		event.People = people
	}
	return s.Events.Update(ctx, event)
}

func (s *Service) DeleteEvent(ctx context.Context, id uuid.UUID) error {
	return s.Events.Delete(ctx, id)
}

func draftFromWrite(write EventWrite) (domain.EventDraft, error) {
	kind := domain.EventKindCall
	if write.Kind != "" {
		parsed, err := domain.ParseEventKind(write.Kind)
		if err != nil {
			return domain.EventDraft{}, err
		}
		kind = parsed
	}
	typ, err := domain.ParseEventType(write.Type)
	if err != nil {
		return domain.EventDraft{}, err
	}
	rec, err := domain.ParseEventRecurrence(write.Recurrence)
	if err != nil {
		return domain.EventDraft{}, err
	}
	duration := write.DurationSeconds
	if duration < 1 {
		duration = domain.DefaultEventDuration
	}
	involvement := 5
	if write.Involvement != nil {
		involvement = *write.Involvement
	}
	canSkip := true
	if write.CanSkip != nil {
		canSkip = *write.CanSkip
	}
	return domain.EventDraft{
		Title:             write.Title,
		Description:       write.Description,
		Agenda:            write.Agenda,
		Kind:              kind,
		Type:              typ,
		ProjectID:         write.ProjectID,
		StartsAt:          write.StartsAt,
		DurationSeconds:   duration,
		Recurrence:        rec,
		Links:             write.Links,
		MeetURL:           write.MeetURL,
		Involvement:       involvement,
		ActiveStartOffset: write.ActiveStartOffset,
		ActiveEndOffset:   write.ActiveEndOffset,
		CanSkip:           canSkip,
	}, nil
}
