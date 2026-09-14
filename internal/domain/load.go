package domain

import "time"

type LoadReport struct {
	From             time.Time     `json:"from"`
	To               time.Time     `json:"to"`
	AllocatedSeconds int64         `json:"allocatedSeconds"`
	WallSeconds      int64         `json:"wallSeconds"`
	ByProject        []ProjectLoad `json:"byProject"`
	ByItem           []ItemLoad    `json:"byItem"`
	Stress           []StressLog   `json:"stress"`
	AverageStress    *float64      `json:"averageStress"`
}

type ProjectLoad struct {
	ProjectID        *string `json:"projectId"`
	Name             string  `json:"name"`
	Color            string  `json:"color"`
	TargetHoursWeek  float64 `json:"targetHoursWeek"`
	AllocatedSeconds int64   `json:"allocatedSeconds"`
}

type ItemLoad struct {
	ItemID           string   `json:"itemId"`
	Title            string   `json:"title"`
	Kind             ItemKind `json:"kind"`
	ProjectName      string   `json:"projectName"`
	AllocatedSeconds int64    `json:"allocatedSeconds"`
}
