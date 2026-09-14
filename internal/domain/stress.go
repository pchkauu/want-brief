package domain

import (
	"time"

	"github.com/google/uuid"
)

type StressLog struct {
	ID       uuid.UUID  `json:"id"`
	ItemID   *uuid.UUID `json:"itemId"`
	Level    int        `json:"level"`
	LoggedAt time.Time  `json:"loggedAt"`
}

func NewStressLog(level int, itemID *uuid.UUID, at time.Time) (StressLog, error) {
	if err := ValidateStress(level); err != nil {
		return StressLog{}, err
	}
	if at.IsZero() {
		at = time.Now().UTC()
	}
	return StressLog{
		ID:       uuid.New(),
		ItemID:   itemID,
		Level:    level,
		LoggedAt: at.UTC(),
	}, nil
}
