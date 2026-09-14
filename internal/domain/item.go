package domain

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type ItemKind string

const (
	KindTask       ItemKind = "task"
	KindNote       ItemKind = "note"
	KindAgreement  ItemKind = "agreement"
	KindObligation ItemKind = "obligation"
	KindInitiative ItemKind = "initiative"
	KindLife       ItemKind = "life"
)

type ItemStatus string

const (
	StatusOpen ItemStatus = "open"
	StatusDone ItemStatus = "done"
)

type Quadrant string

const (
	QuadrantDo       Quadrant = "do"
	QuadrantSchedule Quadrant = "schedule"
	QuadrantDelegate Quadrant = "delegate"
	QuadrantDrop     Quadrant = "drop"
)

type Item struct {
	ID           uuid.UUID  `json:"id"`
	SourceID     uuid.UUID  `json:"sourceId"`
	ExternalKey  string     `json:"externalKey"`
	Title        string     `json:"title"`
	Status       ItemStatus `json:"status"`
	Kind         ItemKind   `json:"kind"`
	ProjectID    *uuid.UUID `json:"projectId"`
	Urgent       bool       `json:"urgent"`
	Important    bool       `json:"important"`
	Stress       *int       `json:"stress"`
	DueAt        *time.Time `json:"dueAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	SourceName   string     `json:"sourceName"`
	SourceKind   SourceKind `json:"sourceKind"`
	ProjectName  string     `json:"projectName"`
	ProjectColor string     `json:"projectColor"`
	QuadrantName Quadrant   `json:"quadrant"`
}

func ParseItemKind(raw string) (ItemKind, error) {
	kind := ItemKind(raw)
	switch kind {
	case KindTask, KindNote, KindAgreement, KindObligation, KindInitiative, KindLife:
		return kind, nil
	default:
		return "", fmt.Errorf("%w: item kind", ErrInvalid)
	}
}

func ParseItemStatus(raw string) (ItemStatus, error) {
	status := ItemStatus(raw)
	switch status {
	case StatusOpen, StatusDone:
		return status, nil
	default:
		return "", fmt.Errorf("%w: item status", ErrInvalid)
	}
}

func (i Item) Quadrant() Quadrant {
	return QuadrantOf(i.Urgent, i.Important)
}

func (i Item) WithQuadrant() Item {
	i.QuadrantName = i.Quadrant()
	return i
}

func QuadrantOf(urgent, important bool) Quadrant {
	switch {
	case urgent && important:
		return QuadrantDo
	case important:
		return QuadrantSchedule
	case urgent:
		return QuadrantDelegate
	default:
		return QuadrantDrop
	}
}

func ValidateStress(level int) error {
	if level < 1 || level > 5 {
		return fmt.Errorf("%w: stress must be 1-5", ErrInvalid)
	}
	return nil
}

func NewLocalItem(sourceID uuid.UUID, title string, kind ItemKind) (Item, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Item{}, fmt.Errorf("%w: title", ErrInvalid)
	}
	if kind == "" {
		kind = KindTask
	}
	if _, err := ParseItemKind(string(kind)); err != nil {
		return Item{}, err
	}
	now := time.Now().UTC()
	return Item{
		ID:        uuid.New(),
		SourceID:  sourceID,
		Title:     title,
		Status:    StatusOpen,
		Kind:      kind,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}
