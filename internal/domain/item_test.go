package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestQuadrantOf(t *testing.T) {
	cases := []struct {
		urgent    bool
		important bool
		want      Quadrant
	}{
		{true, true, QuadrantDo},
		{false, true, QuadrantSchedule},
		{true, false, QuadrantDelegate},
		{false, false, QuadrantDrop},
	}
	for _, tc := range cases {
		got := QuadrantOf(tc.urgent, tc.important)
		if got != tc.want {
			t.Fatalf("QuadrantOf(%v,%v)=%s want %s", tc.urgent, tc.important, got, tc.want)
		}
	}
}

func TestNewLocalItemRejectsEmptyTitle(t *testing.T) {
	_, err := NewLocalItem(uuid.Nil, "  ", KindTask)
	if err == nil {
		t.Fatal("expected invalid title")
	}
}

func TestNewLocalItemStartsBacklog(t *testing.T) {
	item, err := NewLocalItem(uuid.New(), "Ship", KindTask)
	if err != nil {
		t.Fatal(err)
	}
	if item.Status != StatusBacklog {
		t.Fatalf("status %s", item.Status)
	}
}

func TestParseItemStatusForKindRejectsReviewOnAgreement(t *testing.T) {
	if _, err := ParseItemStatusForKind(string(StatusReview), KindAgreement); err == nil {
		t.Fatal("expected invalid status")
	}
}

func TestParseItemStatusForKindAllowsToDoOnAgreement(t *testing.T) {
	status, err := ParseItemStatusForKind(string(StatusToDo), KindAgreement)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusToDo {
		t.Fatalf("status %s", status)
	}
}

func TestParseItemStatusForKindAllowsNeedsGroomingOnAgreement(t *testing.T) {
	status, err := ParseItemStatusForKind(string(StatusNeedsGrooming), KindAgreement)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusNeedsGrooming {
		t.Fatalf("status %s", status)
	}
}

func TestParseItemStatusForKindAllowsClarificationOnAgreement(t *testing.T) {
	status, err := ParseItemStatusForKind(string(StatusClarification), KindAgreement)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusClarification {
		t.Fatalf("status %s", status)
	}
}

func TestParseItemStatusForKindAllowsCancelledOnAgreement(t *testing.T) {
	status, err := ParseItemStatusForKind(string(StatusCancelled), KindAgreement)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusCancelled {
		t.Fatalf("status %s", status)
	}
}

func TestParseItemStatusForKindAllowsReviewOnTask(t *testing.T) {
	status, err := ParseItemStatusForKind(string(StatusReview), KindTask)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusReview {
		t.Fatalf("status %s", status)
	}
}

func TestParseItemStatusForKindAllowsAwaitingDecisionOnTask(t *testing.T) {
	status, err := ParseItemStatusForKind(string(StatusAwaitingDecision), KindTask)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusAwaitingDecision {
		t.Fatalf("status %s", status)
	}
}

func TestParseItemStatusForKindRejectsAwaitingDecisionOnAgreement(t *testing.T) {
	if _, err := ParseItemStatusForKind(string(StatusAwaitingDecision), KindAgreement); err == nil {
		t.Fatal("expected invalid status")
	}
}

func TestSetPlannedSecondsRejectsNegative(t *testing.T) {
	item, err := NewLocalItem(uuid.New(), "Ship", KindTask)
	if err != nil {
		t.Fatal(err)
	}
	if err := item.SetPlannedSeconds(-1); err == nil {
		t.Fatal("expected invalid planned seconds")
	}
}

func TestItemArchiveSetsTimeOnce(t *testing.T) {
	item, err := NewLocalItem(uuid.New(), "Ship", KindTask)
	if err != nil {
		t.Fatal(err)
	}
	first := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	item.Archive(first)
	if item.ArchivedAt == nil || !item.ArchivedAt.Equal(first) {
		t.Fatalf("archived at %v", item.ArchivedAt)
	}
	item.Archive(first.Add(time.Hour))
	if !item.ArchivedAt.Equal(first) {
		t.Fatalf("second archive moved time to %v", item.ArchivedAt)
	}
}

func TestItemRestoreClearsArchive(t *testing.T) {
	item, err := NewLocalItem(uuid.New(), "Ship", KindTask)
	if err != nil {
		t.Fatal(err)
	}
	archived := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	item.Archive(archived)
	restored := archived.Add(time.Hour)
	item.Restore(restored)
	if item.ArchivedAt != nil {
		t.Fatalf("still archived %v", item.ArchivedAt)
	}
	if !item.UpdatedAt.Equal(restored) {
		t.Fatalf("updated at %v", item.UpdatedAt)
	}
}

func TestNewItemNoteRejectsEmptyBody(t *testing.T) {
	if _, err := NewItemNote(uuid.New(), "  "); err == nil {
		t.Fatal("expected invalid body")
	}
}
