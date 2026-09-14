package domain

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type SourceKind string

const (
	SourceJira    SourceKind = "jira"
	SourceTodoist SourceKind = "todoist"
	SourceLocal   SourceKind = "local"
)

type Source struct {
	ID          uuid.UUID  `json:"id"`
	Kind        SourceKind `json:"kind"`
	Name        string     `json:"name"`
	BaseURL     string     `json:"baseUrl"`
	TokenSealed string     `json:"-"`
	HasToken    bool       `json:"hasToken"`
	QueryFilter string     `json:"query"`
	LastSyncAt  *time.Time `json:"lastSyncAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type RemoteItem struct {
	ExternalKey   string
	Title         string
	Status        ItemStatus
	DueAt         *time.Time
	HintUrgent    bool
	HintImportant bool
}

func ParseSourceKind(raw string) (SourceKind, error) {
	kind := SourceKind(raw)
	switch kind {
	case SourceJira, SourceTodoist, SourceLocal:
		return kind, nil
	default:
		return "", fmt.Errorf("%w: source kind", ErrInvalid)
	}
}

func DefaultQuery(kind SourceKind) string {
	switch kind {
	case SourceJira:
		return "assignee = currentUser() AND statusCategory != Done"
	default:
		return ""
	}
}

func NewSource(kind SourceKind, name, baseURL, query string) (Source, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Source{}, fmt.Errorf("%w: source name", ErrInvalid)
	}
	if kind == SourceJira && strings.TrimSpace(baseURL) == "" {
		return Source{}, fmt.Errorf("%w: jira base url", ErrInvalid)
	}
	if query == "" {
		query = DefaultQuery(kind)
	}
	if kind == SourceTodoist && strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.todoist.com"
	}
	now := time.Now().UTC()
	return Source{
		ID:          uuid.New(),
		Kind:        kind,
		Name:        name,
		BaseURL:     strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		QueryFilter: query,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (s Source) Public() Source {
	s.TokenSealed = ""
	return s
}
