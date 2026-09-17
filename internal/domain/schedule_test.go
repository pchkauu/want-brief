package domain

import (
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
)

func msk(y int, m time.Month, d, h, min int) time.Time {
	return time.Date(y, m, d, h, min, 0, 0, Moscow())
}

func taskItem(title string, project *uuid.UUID, name, color string, due time.Time, plan int, tracked int64, status ItemStatus) Item {
	item := Item{
		ID:             uuid.New(),
		Title:          title,
		Status:         status,
		Kind:           KindTask,
		Occupancy:      OccupancySolo,
		ProjectID:      project,
		ProjectName:    name,
		ProjectColor:   color,
		DevDueAt:       &due,
		PlannedSeconds: plan,
		TrackedSeconds: tracked,
		CreatedAt:      msk(2026, 1, 1, 12, 0).UTC(),
	}
	return item.WithQuadrant()
}

func TestBuildScheduleSkipsReviewOnWork(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Review", &pid, "A", "#f00", due, 3600, 0, StatusReview)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 0 || len(got.Unplanned) != 0 {
		t.Fatalf("lanes=%d unplanned=%d", len(got.Lanes), len(got.Unplanned))
	}
}

func TestBuildScheduleSkipsNeedsGrooming(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Groom", &pid, "A", "#f00", due, 3600, 0, StatusNeedsGrooming)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 0 || len(got.Unplanned) != 0 {
		t.Fatalf("lanes=%d unplanned=%d", len(got.Lanes), len(got.Unplanned))
	}
}

func TestBuildScheduleSkipsAwaitingDecision(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Wait", &pid, "A", "#f00", due, 3600, 0, StatusAwaitingDecision)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 0 || len(got.Unplanned) != 0 {
		t.Fatalf("lanes=%d unplanned=%d", len(got.Lanes), len(got.Unplanned))
	}
}

func TestBuildScheduleSkipsBacklog(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Inbox", &pid, "A", "#f00", due, 3600, 0, StatusBacklog)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 0 || len(got.Unplanned) != 0 {
		t.Fatalf("lanes=%d unplanned=%d", len(got.Lanes), len(got.Unplanned))
	}
}

func TestBuildScheduleSkipsBlocked(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Stuck", &pid, "A", "#f00", due, 3600, 0, StatusBlocked)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 0 || len(got.Unplanned) != 0 {
		t.Fatalf("lanes=%d unplanned=%d", len(got.Lanes), len(got.Unplanned))
	}
}

func TestBuildScheduleMissingDevDueIsUnplanned(t *testing.T) {
	pid := uuid.New()
	item := taskItem("Need due", &pid, "A", "#f00", msk(2026, 9, 20, 18, 0), 3600, 0, StatusToDo)
	item.DevDueAt = nil
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Unplanned) != 1 || !got.Unplanned[0].MissingDevDue || got.Unplanned[0].MissingPlan {
		t.Fatalf("%+v", got.Unplanned)
	}
}

func TestBuildScheduleMissingPlanIsUnplanned(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Need plan", &pid, "A", "#f00", due, 0, 0, StatusToDo)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Unplanned) != 1 || !got.Unplanned[0].MissingPlan || got.Unplanned[0].MissingDevDue {
		t.Fatalf("%+v", got.Unplanned)
	}
	if len(got.Lanes) != 0 {
		t.Fatalf("lanes %d", len(got.Lanes))
	}
}

func TestBuildScheduleSerialProjects(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	a, b := uuid.New(), uuid.New()
	first := taskItem("A1", &a, "Alpha", "#111", due, 2*3600, 0, StatusToDo)
	first.CreatedAt = msk(2026, 1, 2, 12, 0).UTC()
	second := taskItem("B1", &b, "Beta", "#222", due, 2*3600, 0, StatusToDo)
	second.CreatedAt = msk(2026, 1, 1, 12, 0).UTC()
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{first, second}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 2 {
		t.Fatalf("lanes %d", len(got.Lanes))
	}
	alpha := laneNamed(got, "Alpha")
	beta := laneNamed(got, "Beta")
	if !alpha.Blocks[0].StartsAt.Equal(msk(2026, 9, 15, 10, 0).UTC()) {
		t.Fatalf("alpha start %s", alpha.Blocks[0].StartsAt)
	}
	if !alpha.Blocks[0].EndsAt.Equal(msk(2026, 9, 15, 12, 0).UTC()) {
		t.Fatalf("alpha end %s", alpha.Blocks[0].EndsAt)
	}
	if !beta.Blocks[0].StartsAt.Equal(alpha.Blocks[0].EndsAt) {
		t.Fatalf("beta start %s want %s", beta.Blocks[0].StartsAt, alpha.Blocks[0].EndsAt)
	}
}

func TestBuildScheduleMeetingThenNextProject(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	a, b := uuid.New(), uuid.New()
	first := taskItem("A1", &a, "Alpha", "#111", due, 3*3600, 0, StatusToDo)
	first.CreatedAt = msk(2026, 1, 2, 12, 0).UTC()
	second := taskItem("B1", &b, "Beta", "#222", due, 3*3600, 0, StatusToDo)
	meetStart := msk(2026, 9, 15, 10, 0)
	sid := uuid.New()
	events := []EventOccurrence{{
		SeriesID: sid,
		Title:    "Standup",
		StartsAt: meetStart,
		EndsAt:   meetStart.Add(time.Hour),
	}}
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{first, second}, events, now, now, now.Add(24*time.Hour))
	if !hasBusyTitle(got, "Standup") || !hasBusyTitle(got, "Lunch") {
		t.Fatalf("busy %+v", got.Busy)
	}
	alpha := laneNamed(got, "Alpha")
	if !alpha.Blocks[0].StartsAt.Equal(meetStart.Add(time.Hour).UTC()) {
		t.Fatalf("alpha start %s", alpha.Blocks[0].StartsAt)
	}
	beta := laneNamed(got, "Beta")
	lastAlpha := alpha.Blocks[len(alpha.Blocks)-1]
	if !beta.Blocks[0].StartsAt.Equal(lastAlpha.EndsAt) && !beta.Blocks[0].StartsAt.After(lastAlpha.EndsAt) {
		t.Fatalf("beta %s overlaps alpha end %s", beta.Blocks[0].StartsAt, lastAlpha.EndsAt)
	}
}

func TestBuildScheduleSplitsLongTicket(t *testing.T) {
	due := msk(2026, 9, 30, 18, 0)
	pid := uuid.New()
	item := taskItem("Long", &pid, "Alpha", "#111", due, 20*3600, 0, StatusToDo)
	now := msk(2026, 9, 15, 8, 0)
	from := now
	to := msk(2026, 9, 17, 0, 0)
	got := BuildSchedule([]Item{item}, nil, now, from, to)
	if len(got.Lanes) != 1 {
		t.Fatalf("lanes %d", len(got.Lanes))
	}
	blocks := got.Lanes[0].Blocks
	if len(blocks) != 4 {
		t.Fatalf("blocks %d", len(blocks))
	}
	if dur := blocks[0].EndsAt.Sub(blocks[0].StartsAt); dur != 3*time.Hour {
		t.Fatalf("morning %s", dur)
	}
	if dur := blocks[1].EndsAt.Sub(blocks[1].StartsAt); dur != 5*time.Hour {
		t.Fatalf("afternoon %s", dur)
	}
	if !blocks[0].Continues || blocks[0].Continued {
		t.Fatalf("first continued=%v continues=%v", blocks[0].Continued, blocks[0].Continues)
	}
	if !blocks[3].Continued || !blocks[3].Continues {
		t.Fatalf("last continued=%v continues=%v", blocks[3].Continued, blocks[3].Continues)
	}
	var total time.Duration
	for _, block := range blocks {
		total += block.EndsAt.Sub(block.StartsAt)
	}
	if total != 16*time.Hour {
		t.Fatalf("visible %s", total)
	}
}

func TestBuildScheduleLateAfterDevDue(t *testing.T) {
	due := msk(2026, 9, 15, 9, 0)
	pid := uuid.New()
	item := taskItem("Late", &pid, "Alpha", "#111", due, 2*3600, 0, StatusToDo)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	block := got.Lanes[0].Blocks[0]
	if !block.Late {
		t.Fatal("expected late")
	}
}

func TestBuildScheduleSkipsPastHoursToday(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Now", &pid, "Alpha", "#111", due, 3600, 0, StatusToDo)
	now := msk(2026, 9, 15, 15, 0)
	got := BuildSchedule([]Item{item}, nil, now, msk(2026, 9, 15, 0, 0), msk(2026, 9, 16, 0, 0))
	start := got.Lanes[0].Blocks[0].StartsAt
	if !start.Equal(now.UTC()) {
		t.Fatalf("start %s want %s", start, now.UTC())
	}
}

func TestBuildScheduleSkipsFullyTracked(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Done hours", &pid, "Alpha", "#111", due, 3600, 3600, StatusInProgress)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 0 || len(got.Unplanned) != 0 {
		t.Fatalf("lanes=%d unplanned=%d", len(got.Lanes), len(got.Unplanned))
	}
}

func TestBuildScheduleSkipsLunch(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	item := taskItem("Across lunch", &pid, "Alpha", "#111", due, 4*3600, 0, StatusToDo)
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	blocks := laneNamed(got, "Alpha").Blocks
	if len(blocks) != 2 {
		t.Fatalf("blocks %d", len(blocks))
	}
	if !blocks[0].EndsAt.Equal(msk(2026, 9, 15, 13, 0).UTC()) {
		t.Fatalf("pre-lunch %s", blocks[0].EndsAt)
	}
	if !blocks[1].StartsAt.Equal(msk(2026, 9, 15, 14, 0).UTC()) {
		t.Fatalf("post-lunch %s", blocks[1].StartsAt)
	}
}

func TestBuildScheduleSkipsWeekend(t *testing.T) {
	due := msk(2026, 9, 30, 18, 0)
	pid := uuid.New()
	item := taskItem("Weekend", &pid, "Alpha", "#111", due, 3600, 0, StatusToDo)
	now := msk(2026, 9, 19, 8, 0)
	from := msk(2026, 9, 19, 0, 0)
	to := msk(2026, 9, 21, 0, 0)
	got := BuildSchedule([]Item{item}, nil, now, from, to)
	if len(got.Lanes) != 0 {
		t.Fatalf("lanes %d", len(got.Lanes))
	}
}

func TestBuildScheduleOverflowAfterDue(t *testing.T) {
	due := msk(2026, 9, 15, 11, 0)
	pid := uuid.New()
	item := taskItem("Late", &pid, "Alpha", "#111", due, 4*3600, 0, StatusToDo)
	now := msk(2026, 9, 15, 10, 0)
	got := BuildSchedule([]Item{item}, nil, now, now, now.Add(24*time.Hour))
	if got.Overflow.ItemCount != 1 || got.Overflow.Seconds <= 0 {
		t.Fatalf("%+v", got.Overflow)
	}
	if got.Overflow.FirstDueAt == nil || !got.Overflow.FirstDueAt.Equal(due.UTC()) {
		t.Fatalf("due %+v", got.Overflow.FirstDueAt)
	}
}

func TestBuildSchedulePinnedFirst(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	a, b := uuid.New(), uuid.New()
	plain := taskItem("Plain", &a, "Alpha", "#111", due, 3600, 0, StatusToDo)
	plain.CreatedAt = msk(2026, 1, 2, 12, 0).UTC()
	pinned := taskItem("Pinned", &b, "Beta", "#222", due, 3600, 0, StatusToDo)
	pinned.Pinned = true
	now := msk(2026, 9, 15, 8, 0)
	got := BuildSchedule([]Item{plain, pinned}, nil, now, now, now.Add(24*time.Hour))
	beta := laneNamed(got, "Beta")
	alpha := laneNamed(got, "Alpha")
	if !beta.Blocks[0].StartsAt.Equal(msk(2026, 9, 15, 10, 0).UTC()) {
		t.Fatalf("pinned start %s", beta.Blocks[0].StartsAt)
	}
	if !alpha.Blocks[0].StartsAt.Equal(msk(2026, 9, 15, 11, 0).UTC()) {
		t.Fatalf("plain start %s", alpha.Blocks[0].StartsAt)
	}
}

func TestBuildSchedulePacksThreeParallel(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	now := msk(2026, 9, 15, 8, 0)
	var items []Item
	for i := 0; i < 3; i++ {
		item := taskItem(fmt.Sprintf("P%d", i), &pid, "Alpha", "#111", due, 3600, 0, StatusToDo)
		item.Occupancy = OccupancyParallel
		item.CreatedAt = msk(2026, 1, 1, 12, i).UTC()
		items = append(items, item)
	}
	got := BuildSchedule(items, nil, now, now, now.Add(24*time.Hour))
	blocks := laneNamed(got, "Alpha").Blocks
	if len(blocks) != 3 {
		t.Fatalf("blocks %d", len(blocks))
	}
	start := msk(2026, 9, 15, 10, 0).UTC()
	end := msk(2026, 9, 15, 11, 0).UTC()
	lanes := map[int]bool{}
	for _, block := range blocks {
		if !block.StartsAt.Equal(start) || !block.EndsAt.Equal(end) {
			t.Fatalf("block %s-%s lane %d", block.StartsAt, block.EndsAt, block.Lane)
		}
		if block.Occupancy != OccupancyParallel {
			t.Fatalf("occupancy %s", block.Occupancy)
		}
		lanes[block.Lane] = true
	}
	if len(lanes) != 3 {
		t.Fatalf("lanes %+v", lanes)
	}
}

func TestBuildScheduleFourthParallelWaits(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	now := msk(2026, 9, 15, 8, 0)
	var items []Item
	for i := 0; i < 4; i++ {
		item := taskItem(fmt.Sprintf("P%d", i), &pid, "Alpha", "#111", due, 3600, 0, StatusToDo)
		item.Occupancy = OccupancyParallel
		item.CreatedAt = msk(2026, 1, 1, 12, i).UTC()
		items = append(items, item)
	}
	got := BuildSchedule(items, nil, now, now, now.Add(24*time.Hour))
	blocks := laneNamed(got, "Alpha").Blocks
	if len(blocks) != 4 {
		t.Fatalf("blocks %d", len(blocks))
	}
	late := 0
	for _, block := range blocks {
		if block.StartsAt.Equal(msk(2026, 9, 15, 11, 0).UTC()) {
			late++
		}
	}
	if late != 1 {
		t.Fatalf("waiting blocks %d", late)
	}
}

func TestBuildScheduleSoloExcludesParallel(t *testing.T) {
	due := msk(2026, 9, 20, 18, 0)
	pid := uuid.New()
	now := msk(2026, 9, 15, 8, 0)
	solo := taskItem("Solo", &pid, "Alpha", "#111", due, 2*3600, 0, StatusToDo)
	solo.Occupancy = OccupancySolo
	solo.Pinned = true
	par := taskItem("Par", &pid, "Alpha", "#111", due, 3600, 0, StatusToDo)
	par.Occupancy = OccupancyParallel
	got := BuildSchedule([]Item{solo, par}, nil, now, now, now.Add(24*time.Hour))
	blocks := laneNamed(got, "Alpha").Blocks
	if len(blocks) != 2 {
		t.Fatalf("blocks %d", len(blocks))
	}
	var soloBlock, parBlock ScheduleBlock
	for _, block := range blocks {
		if block.Occupancy == OccupancySolo {
			soloBlock = block
		} else {
			parBlock = block
		}
	}
	if !soloBlock.StartsAt.Equal(msk(2026, 9, 15, 10, 0).UTC()) {
		t.Fatalf("solo start %s", soloBlock.StartsAt)
	}
	if !parBlock.StartsAt.Equal(soloBlock.EndsAt) {
		t.Fatalf("parallel %s overlaps solo %s-%s", parBlock.StartsAt, soloBlock.StartsAt, soloBlock.EndsAt)
	}
}

func TestBuildFollowupScheduleUsesReviewDue(t *testing.T) {
	reviewDue := msk(2026, 9, 16, 18, 0)
	pid := uuid.New()
	item := taskItem("Review me", &pid, "Alpha", "#111", msk(2026, 9, 30, 18, 0), 3600, 0, StatusReview)
	item.ReviewDueAt = &reviewDue
	now := msk(2026, 9, 15, 8, 0)
	got := BuildKindSchedule(ScheduleFollowup, []Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Lanes) != 1 || len(got.Lanes[0].Blocks) != 1 {
		t.Fatalf("lanes %+v unplanned %+v", got.Lanes, got.Unplanned)
	}
}

func TestBuildFollowupScheduleMissingDueIsUnplanned(t *testing.T) {
	pid := uuid.New()
	item := taskItem("Wait", &pid, "Alpha", "#111", msk(2026, 9, 20, 18, 0), 3600, 0, StatusAwaitingDecision)
	item.DueAt = nil
	now := msk(2026, 9, 15, 8, 0)
	got := BuildKindSchedule(ScheduleFollowup, []Item{item}, nil, now, now, now.Add(24*time.Hour))
	if len(got.Unplanned) != 1 || !got.Unplanned[0].MissingDevDue {
		t.Fatalf("%+v", got.Unplanned)
	}
}

func laneNamed(got Schedule, name string) ScheduleLane {
	for _, lane := range got.Lanes {
		if lane.ProjectName == name {
			return lane
		}
	}
	panic(name)
}

func hasBusyTitle(got Schedule, title string) bool {
	for _, row := range got.Busy {
		if row.Title == title {
			return true
		}
	}
	return false
}
