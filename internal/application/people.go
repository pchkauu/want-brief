package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/domain"
)

type PersonWrite struct {
	Name             string
	BornOn           *time.Time
	AgeYears         *int
	Profession       string
	MonthlySalaryUSD float64
	MonthlySalaryRUB float64
	Projects         []domain.PersonRel
	Events           []domain.PersonRel
	ItemIDs          []uuid.UUID
}

func (s *Service) ListPeople(ctx context.Context) ([]domain.Person, error) {
	return s.People.List(ctx)
}

func (s *Service) GetPerson(ctx context.Context, id uuid.UUID) (domain.Person, error) {
	return s.People.Get(ctx, id)
}

func (s *Service) CreatePerson(ctx context.Context, write PersonWrite) (domain.Person, error) {
	person, err := domain.NewPerson(draftFromPerson(write))
	if err != nil {
		return domain.Person{}, err
	}
	return s.People.Create(ctx, person)
}

func (s *Service) ReplacePerson(ctx context.Context, id uuid.UUID, write PersonWrite) (domain.Person, error) {
	person, err := s.People.Get(ctx, id)
	if err != nil {
		return domain.Person{}, err
	}
	if err := person.Apply(draftFromPerson(write)); err != nil {
		return domain.Person{}, err
	}
	return s.People.Update(ctx, person)
}

func (s *Service) DeletePerson(ctx context.Context, id uuid.UUID) error {
	return s.People.Delete(ctx, id)
}

func (s *Service) ListPersonNotes(ctx context.Context, personID uuid.UUID) ([]domain.PersonNote, error) {
	if _, err := s.People.Get(ctx, personID); err != nil {
		return nil, err
	}
	return s.PersonNotes.ListByPerson(ctx, personID)
}

func (s *Service) CreatePersonNote(ctx context.Context, personID uuid.UUID, body string) (domain.PersonNote, error) {
	if _, err := s.People.Get(ctx, personID); err != nil {
		return domain.PersonNote{}, err
	}
	note, err := domain.NewPersonNote(personID, body)
	if err != nil {
		return domain.PersonNote{}, err
	}
	return s.PersonNotes.Create(ctx, note)
}

func (s *Service) DeletePersonNote(ctx context.Context, personID, noteID uuid.UUID) error {
	note, err := s.PersonNotes.Get(ctx, noteID)
	if err != nil {
		return err
	}
	if note.PersonID != personID {
		return domain.ErrNotFound
	}
	return s.PersonNotes.Delete(ctx, noteID)
}

func draftFromPerson(write PersonWrite) domain.PersonDraft {
	return domain.PersonDraft{
		Name:             write.Name,
		BornOn:           write.BornOn,
		AgeYears:         write.AgeYears,
		Profession:       write.Profession,
		MonthlySalaryUSD: write.MonthlySalaryUSD,
		MonthlySalaryRUB: write.MonthlySalaryRUB,
		Projects:         write.Projects,
		Events:           write.Events,
		ItemIDs:          write.ItemIDs,
	}
}
