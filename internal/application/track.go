package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/domain"
)

func (s *Service) ListOpenIntervals(ctx context.Context) ([]domain.TimeInterval, error) {
	return s.Intervals.ListOpen(ctx)
}

func (s *Service) StartInterval(ctx context.Context, itemID uuid.UUID) (domain.TimeInterval, error) {
	if _, err := s.Items.Get(ctx, itemID); err != nil {
		return domain.TimeInterval{}, err
	}
	return s.Intervals.Create(ctx, domain.NewOpenInterval(itemID, s.now()))
}

func (s *Service) StopInterval(ctx context.Context, id uuid.UUID) (domain.TimeInterval, error) {
	interval, err := s.Intervals.Get(ctx, id)
	if err != nil {
		return domain.TimeInterval{}, err
	}
	stopped, err := interval.Stop(s.now())
	if err != nil {
		return domain.TimeInterval{}, err
	}
	return s.Intervals.Update(ctx, stopped)
}

func (s *Service) CreateStress(ctx context.Context, level int, itemID *uuid.UUID, at *time.Time) (domain.StressLog, error) {
	loggedAt := s.now()
	if at != nil && !at.IsZero() {
		loggedAt = *at
	}
	log, err := domain.NewStressLog(level, itemID, loggedAt)
	if err != nil {
		return domain.StressLog{}, err
	}
	created, err := s.Stress.Create(ctx, log)
	if err != nil {
		return domain.StressLog{}, err
	}
	if itemID != nil {
		item, err := s.Items.Get(ctx, *itemID)
		if err == nil {
			item.Stress = &level
			item.UpdatedAt = s.now()
			_, _ = s.Items.Update(ctx, item)
		}
	}
	return created, nil
}

func (s *Service) Load(ctx context.Context, from, to time.Time) (domain.LoadReport, error) {
	if to.IsZero() {
		to = s.now()
	}
	if from.IsZero() {
		from = to.Add(-7 * 24 * time.Hour)
	}
	if !to.After(from) {
		to = from.Add(time.Hour)
	}
	intervals, err := s.Intervals.ListRange(ctx, from, to)
	if err != nil {
		return domain.LoadReport{}, err
	}
	stress, err := s.Stress.ListRange(ctx, from, to)
	if err != nil {
		return domain.LoadReport{}, err
	}
	items, err := s.Items.List(ctx, domain.ItemFilter{})
	if err != nil {
		return domain.LoadReport{}, err
	}
	projects, err := s.Projects.List(ctx)
	if err != nil {
		return domain.LoadReport{}, err
	}

	now := s.now()
	itemsByID := map[uuid.UUID]domain.Item{}
	for _, item := range items {
		itemsByID[item.ID] = item
	}
	projectsByID := map[uuid.UUID]domain.Project{}
	for _, project := range projects {
		projectsByID[project.ID] = project
	}

	allocatedByItem := map[uuid.UUID]int64{}
	for _, interval := range intervals {
		allocatedByItem[interval.ItemID] += domain.AllocatedSeconds([]domain.TimeInterval{interval}, from, to, now)
	}

	projectSeconds := map[string]int64{}
	unassigned := int64(0)
	itemLoads := make([]domain.ItemLoad, 0, len(allocatedByItem))
	for itemID, seconds := range allocatedByItem {
		if seconds == 0 {
			continue
		}
		item := itemsByID[itemID]
		name := item.Title
		if name == "" {
			name = itemID.String()
		}
		projectName := item.ProjectName
		key := "none"
		if item.ProjectID != nil {
			key = item.ProjectID.String()
			if project, ok := projectsByID[*item.ProjectID]; ok {
				projectName = project.Name
			}
		} else {
			unassigned += seconds
		}
		if key != "none" {
			projectSeconds[key] += seconds
		}
		itemLoads = append(itemLoads, domain.ItemLoad{
			ItemID:           itemID.String(),
			Title:            name,
			Kind:             item.Kind,
			ProjectName:      projectName,
			AllocatedSeconds: seconds,
		})
	}

	byProject := make([]domain.ProjectLoad, 0, len(projects)+1)
	for _, project := range projects {
		id := project.ID.String()
		byProject = append(byProject, domain.ProjectLoad{
			ProjectID:        &id,
			Name:             project.Name,
			Color:            project.Color,
			TargetHoursWeek:  project.TargetHoursWeek,
			AllocatedSeconds: projectSeconds[id],
		})
	}
	if unassigned > 0 {
		byProject = append(byProject, domain.ProjectLoad{
			Name:             "Unassigned",
			Color:            "#6B6B8C",
			AllocatedSeconds: unassigned,
		})
	}

	var avg *float64
	if len(stress) > 0 {
		sum := 0
		for _, log := range stress {
			sum += log.Level
		}
		value := float64(sum) / float64(len(stress))
		avg = &value
	}
	if itemLoads == nil {
		itemLoads = []domain.ItemLoad{}
	}
	if byProject == nil {
		byProject = []domain.ProjectLoad{}
	}
	if stress == nil {
		stress = []domain.StressLog{}
	}

	return domain.LoadReport{
		From:             from,
		To:               to,
		AllocatedSeconds: domain.AllocatedSeconds(intervals, from, to, now),
		WallSeconds:      domain.WallSeconds(intervals, from, to, now),
		ByProject:        byProject,
		ByItem:           itemLoads,
		Stress:           stress,
		AverageStress:    avg,
	}, nil
}
