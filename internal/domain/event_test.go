package domain

import (
	"testing"
	"time"
)

func TestNewEventRejectsEmptyTitle(t *testing.T) {
	_, err := NewEvent("  ", EventKindCall, time.Now(), nil)
	if err == nil {
		t.Fatal("expected invalid title")
	}
}

func TestNewEventRejectsZeroStart(t *testing.T) {
	_, err := NewEvent("Standup", EventKindCall, time.Time{}, nil)
	if err == nil {
		t.Fatal("expected invalid startsAt")
	}
}

func TestNewEventFromRejectsInvolvement(t *testing.T) {
	_, err := NewEventFrom(EventDraft{
		Title:           "Sync",
		Kind:            EventKindCall,
		Type:            EventTypeSync,
		StartsAt:        time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC),
		DurationSeconds: 1800,
		Involvement:     11,
	})
	if err == nil {
		t.Fatal("expected invalid involvement")
	}
}

func TestNewEventFromRejectsActiveOutsideDuration(t *testing.T) {
	start, end := 0, 1900
	_, err := NewEventFrom(EventDraft{
		Title:             "Sync",
		Kind:              EventKindCall,
		Type:              EventTypeSync,
		StartsAt:          time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC),
		DurationSeconds:   1800,
		ActiveStartOffset: &start,
		ActiveEndOffset:   &end,
	})
	if err == nil {
		t.Fatal("expected invalid active interval")
	}
}

func TestExpandOnceStaysSingle(t *testing.T) {
	start := time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC)
	event, err := NewEventFrom(EventDraft{
		Title:           "Retro",
		Kind:            EventKindEvent,
		Type:            EventTypeRetro,
		StartsAt:        start,
		DurationSeconds: 3600,
		Recurrence:      RecurrenceOnce,
	})
	if err != nil {
		t.Fatal(err)
	}
	from := time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 9, 28, 0, 0, 0, 0, time.UTC)
	got := event.Expand(from, to)
	if len(got) != 1 || !got[0].StartsAt.Equal(start) {
		t.Fatalf("got %+v", got)
	}
}

func TestExpandWeeklyHitsWeekdays(t *testing.T) {
	start := time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC) // Wednesday
	event, err := NewEventFrom(EventDraft{
		Title:           "Grooming",
		Kind:            EventKindCall,
		Type:            EventTypeGrooming,
		StartsAt:        start,
		DurationSeconds: 1800,
		Recurrence:      RecurrenceWeekly,
	})
	if err != nil {
		t.Fatal(err)
	}
	from := time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 9, 28, 0, 0, 0, 0, time.UTC)
	got := event.Expand(from, to)
	if len(got) != 2 {
		t.Fatalf("len %d", len(got))
	}
	if !got[0].StartsAt.Equal(start) || !got[1].StartsAt.Equal(start.AddDate(0, 0, 7)) {
		t.Fatalf("got %v %v", got[0].StartsAt, got[1].StartsAt)
	}
}

func TestExpandMonthlyHitsNextMonth(t *testing.T) {
	start := time.Date(2026, 8, 15, 9, 0, 0, 0, time.UTC)
	event, err := NewEventFrom(EventDraft{
		Title:           "Planning",
		Kind:            EventKindEvent,
		Type:            EventTypePlanning,
		StartsAt:        start,
		DurationSeconds: 3600,
		Recurrence:      RecurrenceMonthly,
	})
	if err != nil {
		t.Fatal(err)
	}
	from := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	got := event.Expand(from, to)
	if len(got) != 1 || got[0].StartsAt.Day() != 15 || got[0].StartsAt.Month() != time.September {
		t.Fatalf("got %+v", got)
	}
}
