package domain

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type PersonRel struct {
	ID      uuid.UUID `json:"id"`
	Comment string    `json:"comment"`
}

type Person struct {
	ID               uuid.UUID   `json:"id"`
	Name             string      `json:"name"`
	BornOn           *time.Time  `json:"bornOn"`
	AgeYears         *int        `json:"ageYears"`
	Age              *int        `json:"age"`
	Profession       string      `json:"profession"`
	MonthlySalaryUSD float64     `json:"monthlySalaryUsd"`
	MonthlySalaryRUB float64     `json:"monthlySalaryRub"`
	Projects         []PersonRel `json:"projects"`
	Events           []PersonRel `json:"events"`
	ItemIDs          []uuid.UUID `json:"itemIds"`
	CreatedAt        time.Time   `json:"createdAt"`
	UpdatedAt        time.Time   `json:"updatedAt"`
}

type PersonDraft struct {
	Name             string
	BornOn           *time.Time
	AgeYears         *int
	Profession       string
	MonthlySalaryUSD float64
	MonthlySalaryRUB float64
	Projects         []PersonRel
	Events           []PersonRel
	ItemIDs          []uuid.UUID
}

func NewPerson(draft PersonDraft) (Person, error) {
	now := time.Now().UTC()
	person := Person{
		ID:        uuid.New(),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := person.apply(draft); err != nil {
		return Person{}, err
	}
	return person.WithAge(now), nil
}

func (p *Person) Apply(draft PersonDraft) error {
	if err := p.apply(draft); err != nil {
		return err
	}
	p.UpdatedAt = time.Now().UTC()
	return nil
}

func (p *Person) apply(draft PersonDraft) error {
	name := strings.TrimSpace(draft.Name)
	if name == "" {
		return fmt.Errorf("%w: person name", ErrInvalid)
	}
	if draft.BornOn != nil && draft.AgeYears != nil {
		return fmt.Errorf("%w: bornOn or ageYears", ErrInvalid)
	}
	if draft.AgeYears != nil && (*draft.AgeYears < 0 || *draft.AgeYears > 150) {
		return fmt.Errorf("%w: ageYears", ErrInvalid)
	}
	if draft.MonthlySalaryUSD < 0 {
		return fmt.Errorf("%w: monthly salary usd", ErrInvalid)
	}
	if draft.MonthlySalaryRUB < 0 {
		return fmt.Errorf("%w: monthly salary rub", ErrInvalid)
	}
	var bornOn *time.Time
	if draft.BornOn != nil {
		day := time.Date(draft.BornOn.Year(), draft.BornOn.Month(), draft.BornOn.Day(), 0, 0, 0, 0, time.UTC)
		bornOn = &day
	}
	p.Name = name
	p.BornOn = bornOn
	p.AgeYears = draft.AgeYears
	p.Profession = strings.TrimSpace(draft.Profession)
	p.MonthlySalaryUSD = draft.MonthlySalaryUSD
	p.MonthlySalaryRUB = draft.MonthlySalaryRUB
	projects, err := NormalizePersonRels(draft.Projects)
	if err != nil {
		return err
	}
	events, err := NormalizePersonRels(draft.Events)
	if err != nil {
		return err
	}
	p.Projects = projects
	p.Events = events
	p.ItemIDs = NormalizeIDs(draft.ItemIDs)
	return nil
}

func (p Person) AgeAt(now time.Time) *int {
	if p.BornOn != nil {
		years := yearsSince(*p.BornOn, now)
		return &years
	}
	return p.AgeYears
}

func (p Person) WithAge(now time.Time) Person {
	p.Age = p.AgeAt(now)
	if p.Projects == nil {
		p.Projects = []PersonRel{}
	}
	if p.Events == nil {
		p.Events = []PersonRel{}
	}
	if p.ItemIDs == nil {
		p.ItemIDs = []uuid.UUID{}
	}
	return p
}

func yearsSince(born, now time.Time) int {
	years := now.UTC().Year() - born.UTC().Year()
	anniversary := time.Date(now.UTC().Year(), born.Month(), born.Day(), 0, 0, 0, 0, time.UTC)
	if now.UTC().Before(anniversary) {
		years--
	}
	if years < 0 {
		return 0
	}
	return years
}

func NormalizePersonRels(rels []PersonRel) ([]PersonRel, error) {
	out := make([]PersonRel, 0, len(rels))
	seen := make(map[uuid.UUID]struct{}, len(rels))
	for _, rel := range rels {
		if rel.ID == uuid.Nil {
			continue
		}
		if _, ok := seen[rel.ID]; ok {
			continue
		}
		comment := strings.TrimSpace(rel.Comment)
		if comment == "" {
			return nil, fmt.Errorf("%w: link comment", ErrInvalid)
		}
		seen[rel.ID] = struct{}{}
		out = append(out, PersonRel{ID: rel.ID, Comment: comment})
	}
	return out, nil
}

func NormalizeIDs(ids []uuid.UUID) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(ids))
	seen := make(map[uuid.UUID]struct{}, len(ids))
	for _, id := range ids {
		if id == uuid.Nil {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
