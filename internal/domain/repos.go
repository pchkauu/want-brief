package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type ItemFilter struct {
	SourceID  *uuid.UUID
	ProjectID *uuid.UUID
	Kind      *ItemKind
	Status    *ItemStatus
	OpenOnly  bool
}

type ItemRepository interface {
	Get(ctx context.Context, id uuid.UUID) (Item, error)
	List(ctx context.Context, filter ItemFilter) ([]Item, error)
	Create(ctx context.Context, item Item) (Item, error)
	Update(ctx context.Context, item Item) (Item, error)
	Delete(ctx context.Context, id uuid.UUID) error
	UpsertSynced(ctx context.Context, item Item) (Item, error)
}

type ProjectRepository interface {
	Get(ctx context.Context, id uuid.UUID) (Project, error)
	List(ctx context.Context) ([]Project, error)
	Create(ctx context.Context, project Project) (Project, error)
	Update(ctx context.Context, project Project) (Project, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type SourceRepository interface {
	Get(ctx context.Context, id uuid.UUID) (Source, error)
	List(ctx context.Context) ([]Source, error)
	Create(ctx context.Context, source Source) (Source, error)
	Update(ctx context.Context, source Source) (Source, error)
	Delete(ctx context.Context, id uuid.UUID) error
	Local(ctx context.Context) (Source, error)
}

type NoteRepository interface {
	Get(ctx context.Context, id uuid.UUID) (Note, error)
	List(ctx context.Context, itemID *uuid.UUID) ([]Note, error)
	Create(ctx context.Context, note Note) (Note, error)
	Update(ctx context.Context, note Note) (Note, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type IntervalRepository interface {
	Get(ctx context.Context, id uuid.UUID) (TimeInterval, error)
	ListOpen(ctx context.Context) ([]TimeInterval, error)
	ListRange(ctx context.Context, from, to time.Time) ([]TimeInterval, error)
	Create(ctx context.Context, interval TimeInterval) (TimeInterval, error)
	Update(ctx context.Context, interval TimeInterval) (TimeInterval, error)
}

type StressRepository interface {
	ListRange(ctx context.Context, from, to time.Time) ([]StressLog, error)
	Create(ctx context.Context, log StressLog) (StressLog, error)
}

type UserRepository interface {
	Count(ctx context.Context) (int, error)
	Create(ctx context.Context, user User) (User, error)
	First(ctx context.Context) (User, error)
}

type SessionRepository interface {
	Create(ctx context.Context, session Session) error
	GetByTokenHash(ctx context.Context, tokenHash string) (Session, error)
	Delete(ctx context.Context, tokenHash string) error
	DeleteExpired(ctx context.Context, now time.Time) error
}

type Puller interface {
	Pull(ctx context.Context, source Source, token string) ([]RemoteItem, error)
}

type TokenBox interface {
	Seal(plaintext string) (string, error)
	Open(sealed string) (string, error)
}
