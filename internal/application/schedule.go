package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/pchkauu/want-brief/internal/domain"
)

func (s *Service) Schedule(ctx context.Context, from, to time.Time) (domain.Schedule, error) {
	if from.IsZero() || to.IsZero() || !to.After(from) {
		return domain.Schedule{}, fmt.Errorf("%w: range", domain.ErrInvalid)
	}
	kind := domain.KindTask
	items, err := s.Items.List(ctx, domain.ItemFilter{Kind: &kind, OpenOnly: true})
	if err != nil {
		return domain.Schedule{}, err
	}
	now := s.now()
	eventFrom := from
	if now.Before(eventFrom) {
		eventFrom = now
	}
	if from.Before(now) {
		eventFrom = from
	}
	eventTo := now.Add(120 * 24 * time.Hour)
	if to.After(eventTo) {
		eventTo = to
	}
	events, err := s.ListEventOccurrences(ctx, eventFrom, eventTo)
	if err != nil {
		return domain.Schedule{}, err
	}
	open, err := s.ListOpenIntervals(ctx)
	if err != nil {
		return domain.Schedule{}, err
	}
	return domain.BuildSchedule(applyOpenTrack(items, open, now), events, now, from, to), nil
}

func applyOpenTrack(items []domain.Item, open []domain.TimeInterval, now time.Time) []domain.Item {
	extra := map[uuid.UUID]int64{}
	for _, interval := range open {
		sec := int64(now.Sub(interval.StartedAt) / time.Second)
		if sec < 0 {
			continue
		}
		extra[interval.ItemID] += sec
	}
	if len(extra) == 0 {
		return items
	}
	out := append([]domain.Item(nil), items...)
	for i := range out {
		out[i].TrackedSeconds += extra[out[i].ID]
	}
	return out
}
