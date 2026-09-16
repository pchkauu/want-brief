package domain

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

type EventKind string

const (
	EventKindEvent EventKind = "event"
	EventKindCall  EventKind = "call"
)

type EventType string

const (
	EventTypeSync       EventType = "sync"
	EventTypeGrooming   EventType = "grooming"
	EventTypeLesson     EventType = "lesson"
	EventTypeMentorship EventType = "mentorship"
	EventTypePlanning   EventType = "planning"
	EventTypeDaily      EventType = "daily"
	EventTypeRetro      EventType = "retro"
	EventTypeOneOnOne   EventType = "one_on_one"
	EventTypeGlobal     EventType = "global"
	EventTypeTeamBuild  EventType = "team_building"
	EventTypeExternal   EventType = "external"
)

type EventRecurrence string

const (
	RecurrenceOnce    EventRecurrence = "once"
	RecurrenceWeekly  EventRecurrence = "weekly"
	RecurrenceMonthly EventRecurrence = "monthly"
)

const (
	DefaultEventDuration = 30 * 60
	maxEventExpand       = 8 * 7 * 24 * time.Hour
	maxEventInvolvement  = 10
)

type Event struct {
	ID                uuid.UUID       `json:"id"`
	Title             string          `json:"title"`
	Description       string          `json:"description"`
	Agenda            string          `json:"agenda"`
	Kind              EventKind       `json:"kind"`
	Type              EventType       `json:"type"`
	ProjectID         *uuid.UUID      `json:"projectId"`
	StartsAt          time.Time       `json:"startsAt"`
	DurationSeconds   int             `json:"durationSeconds"`
	Recurrence        EventRecurrence `json:"recurrence"`
	Links             []ProjectLink   `json:"links"`
	MeetURL           string          `json:"meetUrl"`
	Involvement       int             `json:"involvement"`
	ActiveStartOffset *int            `json:"activeStartOffset"`
	ActiveEndOffset   *int            `json:"activeEndOffset"`
	CanSkip           bool            `json:"canSkip"`
	People            []PersonRel     `json:"people"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}

type EventOccurrence struct {
	ID                uuid.UUID       `json:"id"`
	SeriesID          uuid.UUID       `json:"seriesId"`
	Title             string          `json:"title"`
	Description       string          `json:"description"`
	Agenda            string          `json:"agenda"`
	Kind              EventKind       `json:"kind"`
	Type              EventType       `json:"type"`
	ProjectID         *uuid.UUID      `json:"projectId"`
	StartsAt          time.Time       `json:"startsAt"`
	EndsAt            time.Time       `json:"endsAt"`
	DurationSeconds   int             `json:"durationSeconds"`
	Recurrence        EventRecurrence `json:"recurrence"`
	Links             []ProjectLink   `json:"links"`
	MeetURL           string          `json:"meetUrl"`
	Involvement       int             `json:"involvement"`
	ActiveStartOffset *int            `json:"activeStartOffset"`
	ActiveEndOffset   *int            `json:"activeEndOffset"`
	CanSkip           bool            `json:"canSkip"`
	People            []PersonRel     `json:"people"`
	CreatedAt         time.Time       `json:"createdAt"`
}

type EventDraft struct {
	Title             string
	Description       string
	Agenda            string
	Kind              EventKind
	Type              EventType
	ProjectID         *uuid.UUID
	StartsAt          time.Time
	DurationSeconds   int
	Recurrence        EventRecurrence
	Links             []ProjectLink
	MeetURL           string
	Involvement       int
	ActiveStartOffset *int
	ActiveEndOffset   *int
	CanSkip           bool
}

func ParseEventKind(raw string) (EventKind, error) {
	kind := EventKind(raw)
	switch kind {
	case EventKindEvent, EventKindCall:
		return kind, nil
	default:
		return "", fmt.Errorf("%w: event kind", ErrInvalid)
	}
}

func ParseEventType(raw string) (EventType, error) {
	if raw == "" {
		return EventTypeSync, nil
	}
	typ := EventType(raw)
	switch typ {
	case EventTypeSync, EventTypeGrooming, EventTypeLesson, EventTypeMentorship, EventTypePlanning,
		EventTypeDaily, EventTypeRetro, EventTypeOneOnOne, EventTypeGlobal, EventTypeTeamBuild, EventTypeExternal:
		return typ, nil
	default:
		return "", fmt.Errorf("%w: event type", ErrInvalid)
	}
}

func ParseEventRecurrence(raw string) (EventRecurrence, error) {
	if raw == "" {
		return RecurrenceOnce, nil
	}
	rec := EventRecurrence(raw)
	switch rec {
	case RecurrenceOnce, RecurrenceWeekly, RecurrenceMonthly:
		return rec, nil
	default:
		return "", fmt.Errorf("%w: event recurrence", ErrInvalid)
	}
}

func NewEvent(title string, kind EventKind, startsAt time.Time, endsAt *time.Time) (Event, error) {
	duration := DefaultEventDuration
	if endsAt != nil && !endsAt.Before(startsAt) {
		duration = int(endsAt.Sub(startsAt).Seconds())
		if duration < 1 {
			duration = DefaultEventDuration
		}
	}
	return NewEventFrom(EventDraft{
		Title:           title,
		Kind:            kind,
		Type:            EventTypeSync,
		StartsAt:        startsAt,
		DurationSeconds: duration,
		Recurrence:      RecurrenceOnce,
		Involvement:     5,
		CanSkip:         true,
	})
}

func NewEventFrom(draft EventDraft) (Event, error) {
	now := time.Now().UTC()
	event := Event{
		ID:        uuid.New(),
		CanSkip:   draft.CanSkip,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := event.apply(draft); err != nil {
		return Event{}, err
	}
	return event, nil
}

func (e *Event) Apply(draft EventDraft) error {
	if err := e.apply(draft); err != nil {
		return err
	}
	e.UpdatedAt = time.Now().UTC()
	return nil
}

func (e *Event) apply(draft EventDraft) error {
	title := strings.TrimSpace(draft.Title)
	if title == "" {
		return fmt.Errorf("%w: title", ErrInvalid)
	}
	if _, err := ParseEventKind(string(draft.Kind)); err != nil {
		return err
	}
	typ, err := ParseEventType(string(draft.Type))
	if err != nil {
		return err
	}
	if draft.StartsAt.IsZero() {
		return fmt.Errorf("%w: startsAt", ErrInvalid)
	}
	duration := draft.DurationSeconds
	if duration < 1 {
		return fmt.Errorf("%w: duration", ErrInvalid)
	}
	rec, err := ParseEventRecurrence(string(draft.Recurrence))
	if err != nil {
		return err
	}
	if draft.Involvement < 0 || draft.Involvement > maxEventInvolvement {
		return fmt.Errorf("%w: involvement", ErrInvalid)
	}
	if err := validateActiveWindow(draft.ActiveStartOffset, draft.ActiveEndOffset, duration); err != nil {
		return err
	}
	meet, err := parseOptionalURL(draft.MeetURL)
	if err != nil {
		return err
	}
	links, err := NormalizeLinks(draft.Links)
	if err != nil {
		return err
	}
	e.Title = title
	e.Description = strings.TrimSpace(draft.Description)
	e.Agenda = strings.TrimSpace(draft.Agenda)
	e.Kind = draft.Kind
	e.Type = typ
	e.ProjectID = draft.ProjectID
	e.StartsAt = draft.StartsAt.UTC()
	e.DurationSeconds = duration
	e.Recurrence = rec
	e.Links = links
	e.MeetURL = meet
	e.Involvement = draft.Involvement
	e.ActiveStartOffset = draft.ActiveStartOffset
	e.ActiveEndOffset = draft.ActiveEndOffset
	e.CanSkip = draft.CanSkip
	return nil
}

func validateActiveWindow(start, end *int, duration int) error {
	if start == nil && end == nil {
		return nil
	}
	if start == nil || end == nil {
		return fmt.Errorf("%w: active interval", ErrInvalid)
	}
	if *start < 0 || *end > duration || *end <= *start {
		return fmt.Errorf("%w: active interval", ErrInvalid)
	}
	return nil
}

func parseOptionalURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", fmt.Errorf("%w: meet url", ErrInvalid)
	}
	return parsed.String(), nil
}

func (e Event) EndsAt() time.Time {
	return e.StartsAt.Add(time.Duration(e.DurationSeconds) * time.Second)
}

func (e Event) Occurrence(at time.Time) EventOccurrence {
	start := at.UTC()
	return EventOccurrence{
		ID:                e.ID,
		SeriesID:          e.ID,
		Title:             e.Title,
		Description:       e.Description,
		Agenda:            e.Agenda,
		Kind:              e.Kind,
		Type:              e.Type,
		ProjectID:         e.ProjectID,
		StartsAt:          start,
		EndsAt:            start.Add(time.Duration(e.DurationSeconds) * time.Second),
		DurationSeconds:   e.DurationSeconds,
		Recurrence:        e.Recurrence,
		Links:             e.Links,
		MeetURL:           e.MeetURL,
		Involvement:       e.Involvement,
		ActiveStartOffset: e.ActiveStartOffset,
		ActiveEndOffset:   e.ActiveEndOffset,
		CanSkip:           e.CanSkip,
		People:            e.People,
		CreatedAt:         e.CreatedAt,
	}
}

func (e Event) Expand(from, to time.Time) []EventOccurrence {
	from, to = clampEventRange(from, to)
	switch e.Recurrence {
	case RecurrenceWeekly:
		return e.expandStep(from, to, func(at time.Time) time.Time { return at.AddDate(0, 0, 7) })
	case RecurrenceMonthly:
		return e.expandStep(from, to, func(at time.Time) time.Time { return at.AddDate(0, 1, 0) })
	default:
		if !e.StartsAt.Before(from) && e.StartsAt.Before(to) {
			return []EventOccurrence{e.Occurrence(e.StartsAt)}
		}
		return nil
	}
}

func (e Event) expandStep(from, to time.Time, next func(time.Time) time.Time) []EventOccurrence {
	start := e.StartsAt
	for start.Before(from) {
		n := next(start)
		if !n.After(start) {
			return nil
		}
		start = n
	}
	var out []EventOccurrence
	for start.Before(to) {
		out = append(out, e.Occurrence(start))
		n := next(start)
		if !n.After(start) {
			break
		}
		start = n
	}
	return out
}

func clampEventRange(from, to time.Time) (time.Time, time.Time) {
	if from.IsZero() {
		from = time.Now().UTC()
	}
	if to.IsZero() || to.Before(from) {
		to = from.Add(maxEventExpand)
	}
	if to.Sub(from) > maxEventExpand {
		to = from.Add(maxEventExpand)
	}
	return from.UTC(), to.UTC()
}

func ExpandEvents(events []Event, from, to time.Time) []EventOccurrence {
	from, to = clampEventRange(from, to)
	out := make([]EventOccurrence, 0)
	for _, event := range events {
		out = append(out, event.Expand(from, to)...)
	}
	return out
}
