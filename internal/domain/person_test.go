package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNewPersonRejectsEmptyName(t *testing.T) {
	_, err := NewPerson(PersonDraft{Name: "  "})
	if err == nil {
		t.Fatal("expected invalid name")
	}
}

func TestNewPersonRejectsBornOnAndAge(t *testing.T) {
	born := time.Date(1990, 3, 15, 0, 0, 0, 0, time.UTC)
	age := 35
	_, err := NewPerson(PersonDraft{Name: "Ada", BornOn: &born, AgeYears: &age})
	if err == nil {
		t.Fatal("expected invalid bornOn or ageYears")
	}
}

func TestNewPersonRejectsNegativeSalary(t *testing.T) {
	_, err := NewPerson(PersonDraft{Name: "Ada", MonthlySalaryUSD: -1})
	if err == nil {
		t.Fatal("expected invalid salary")
	}
}

func TestPersonAgeFromBornOn(t *testing.T) {
	born := time.Date(2000, 9, 16, 0, 0, 0, 0, time.UTC)
	person, err := NewPerson(PersonDraft{Name: "Ada", BornOn: &born})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
	got := person.AgeAt(now)
	if got == nil || *got != 25 {
		t.Fatalf("got %v", got)
	}
}

func TestPersonAgeFromYears(t *testing.T) {
	age := 41
	person, err := NewPerson(PersonDraft{Name: "Ada", AgeYears: &age})
	if err != nil {
		t.Fatal(err)
	}
	got := person.AgeAt(time.Now())
	if got == nil || *got != 41 {
		t.Fatalf("got %v", got)
	}
}

func TestOccurrenceCopiesPeople(t *testing.T) {
	id := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	event, err := NewEventFrom(EventDraft{
		Title:           "Sync",
		Kind:            EventKindCall,
		Type:            EventTypeSync,
		StartsAt:        time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC),
		DurationSeconds: 1800,
	})
	if err != nil {
		t.Fatal(err)
	}
	event.People = []PersonRel{{ID: id, Comment: "host"}}
	occ := event.Occurrence(event.StartsAt)
	if len(occ.People) != 1 || occ.People[0].ID != id || occ.People[0].Comment != "host" {
		t.Fatalf("got %+v", occ.People)
	}
}

func TestNormalizePersonRelsRequiresComment(t *testing.T) {
	id := uuid.New()
	if _, err := NormalizePersonRels([]PersonRel{{ID: id, Comment: "  "}}); err == nil {
		t.Fatal("expected invalid comment")
	}
	rels, err := NormalizePersonRels([]PersonRel{{ID: id, Comment: " lead "}, {ID: id, Comment: "dup"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(rels) != 1 || rels[0].Comment != "lead" {
		t.Fatalf("got %+v", rels)
	}
}

func TestNewPersonRejectsEmptyLinkComment(t *testing.T) {
	_, err := NewPerson(PersonDraft{
		Name:     "Ada",
		Projects: []PersonRel{{ID: uuid.New(), Comment: ""}},
	})
	if err == nil {
		t.Fatal("expected invalid link comment")
	}
}
