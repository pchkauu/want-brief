package domain

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Color           string    `json:"color"`
	TargetHoursWeek float64   `json:"targetHoursWeek"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

func NewProject(name, color string, targetHoursWeek float64) (Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Project{}, fmt.Errorf("%w: project name", ErrInvalid)
	}
	if color == "" {
		color = "#4C4CFF"
	}
	if targetHoursWeek < 0 {
		return Project{}, fmt.Errorf("%w: target hours", ErrInvalid)
	}
	now := time.Now().UTC()
	return Project{
		ID:              uuid.New(),
		Name:            name,
		Color:           color,
		TargetHoursWeek: targetHoursWeek,
		CreatedAt:       now,
		UpdatedAt:       now,
	}, nil
}
