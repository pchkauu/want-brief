package domain

import (
	"sort"
	"time"

	"github.com/google/uuid"
)

const (
	scheduleHorizonDays = 120
	gridStartHour       = 8
	workStartHour       = 10
	lunchStartHour      = 13
	lunchEndHour        = 14
	workEndHour         = 19
	lunchTitle          = "Lunch"
)

type Schedule struct {
	Lanes     []ScheduleLane   `json:"lanes"`
	Unplanned []UnplannedItem  `json:"unplanned"`
	Busy      []ScheduleBusy   `json:"busy"`
	Overflow  ScheduleOverflow `json:"overflow"`
	Capacity  ScheduleCapacity `json:"capacity"`
}

type ScheduleLane struct {
	ProjectID    *uuid.UUID      `json:"projectId"`
	ProjectName  string          `json:"projectName"`
	ProjectColor string          `json:"projectColor"`
	Blocks       []ScheduleBlock `json:"blocks"`
}

type ScheduleBlock struct {
	ItemID      uuid.UUID `json:"itemId"`
	Title       string    `json:"title"`
	ExternalKey string    `json:"externalKey"`
	StartsAt    time.Time `json:"startsAt"`
	EndsAt      time.Time `json:"endsAt"`
	Late        bool      `json:"late"`
	Continued   bool      `json:"continued"`
	Continues   bool      `json:"continues"`
}

type UnplannedItem struct {
	Item          Item `json:"item"`
	MissingDevDue bool `json:"missingDevDue"`
	MissingPlan   bool `json:"missingPlan"`
}

type ScheduleBusy struct {
	StartsAt time.Time  `json:"startsAt"`
	EndsAt   time.Time  `json:"endsAt"`
	Title    string     `json:"title"`
	SeriesID *uuid.UUID `json:"seriesId,omitempty"`
}

type ScheduleOverflow struct {
	ItemCount  int        `json:"itemCount"`
	Seconds    int64      `json:"seconds"`
	FirstDueAt *time.Time `json:"firstDueAt"`
}

type ScheduleCapacity struct {
	FreeSeconds   int64 `json:"freeSeconds"`
	PackedSeconds int64 `json:"packedSeconds"`
	BusySeconds   int64 `json:"busySeconds"`
}

type span struct {
	start time.Time
	end   time.Time
}

func emptySchedule() Schedule {
	return Schedule{
		Lanes:     []ScheduleLane{},
		Unplanned: []UnplannedItem{},
		Busy:      []ScheduleBusy{},
	}
}

func BuildSchedule(items []Item, events []EventOccurrence, now, from, to time.Time) Schedule {
	loc := Moscow()
	now = now.In(loc)
	from = from.In(loc)
	to = to.In(loc)
	if !to.After(from) {
		return emptySchedule()
	}

	var unplanned []UnplannedItem
	var queue []Item
	meta := map[string]ScheduleLane{}
	itemLane := map[uuid.UUID]string{}
	for _, item := range items {
		if !scheduleEligible(item) {
			continue
		}
		missingDue := item.DevDueAt == nil
		missingPlan := item.PlannedSeconds <= 0
		if missingDue || missingPlan {
			unplanned = append(unplanned, UnplannedItem{Item: item, MissingDevDue: missingDue, MissingPlan: missingPlan})
			continue
		}
		if remainingSeconds(item) <= 0 {
			continue
		}
		key := laneKey(item.ProjectID)
		queue = append(queue, item)
		itemLane[item.ID] = key
		if _, ok := meta[key]; !ok {
			name := item.ProjectName
			if name == "" {
				name = "No project"
			}
			meta[key] = ScheduleLane{
				ProjectID:    item.ProjectID,
				ProjectName:  name,
				ProjectColor: item.ProjectColor,
			}
		}
	}
	sort.SliceStable(unplanned, func(i, j int) bool {
		return scheduleLessItems(unplanned[i].Item, unplanned[j].Item)
	})
	sort.SliceStable(queue, func(i, j int) bool {
		return scheduleLessItems(queue[i], queue[j])
	})

	free := freeWorkSlots(now, events, loc)
	allBlocks := markContinuation(packLane(queue, cloneSpans(free)))
	overflow := scheduleOverflow(queue, allBlocks)
	visible := filterBlocks(allBlocks, from, to)
	lanes := paintLanes(visible, itemLane, meta)
	if unplanned == nil {
		unplanned = []UnplannedItem{}
	}
	return Schedule{
		Lanes:     lanes,
		Unplanned: unplanned,
		Busy:      busyInRange(events, from, to, loc),
		Overflow:  overflow,
		Capacity:  scheduleCapacity(free, visible, events, from, to, loc),
	}
}

func scheduleEligible(item Item) bool {
	if item.Kind != KindTask || item.ArchivedAt != nil {
		return false
	}
	switch item.Status {
	case StatusToDo, StatusInProgress:
		return true
	default:
		return false
	}
}

func remainingSeconds(item Item) int64 {
	left := int64(item.PlannedSeconds) - item.TrackedSeconds
	if left < 0 {
		return 0
	}
	return left
}

func laneKey(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

func scheduleLessItems(a, b Item) bool {
	if a.Pinned != b.Pinned {
		return a.Pinned
	}
	qa, qb := quadrantRank(a.Quadrant()), quadrantRank(b.Quadrant())
	if qa != qb {
		return qa < qb
	}
	if a.DevDueAt == nil && b.DevDueAt != nil {
		return false
	}
	if a.DevDueAt != nil && b.DevDueAt == nil {
		return true
	}
	if a.DevDueAt != nil && b.DevDueAt != nil && !a.DevDueAt.Equal(*b.DevDueAt) {
		return a.DevDueAt.Before(*b.DevDueAt)
	}
	as, bs := -1, -1
	if a.Stress != nil {
		as = *a.Stress
	}
	if b.Stress != nil {
		bs = *b.Stress
	}
	if as != bs {
		return as > bs
	}
	return a.CreatedAt.After(b.CreatedAt)
}

func quadrantRank(q Quadrant) int {
	switch q {
	case QuadrantDo:
		return 0
	case QuadrantSchedule:
		return 1
	case QuadrantDelegate:
		return 2
	default:
		return 3
	}
}

func isWorkday(day time.Time, loc *time.Location) bool {
	w := day.In(loc).Weekday()
	return w >= time.Monday && w <= time.Friday
}

func atHour(day time.Time, hour int, loc *time.Location) time.Time {
	y, m, d := day.In(loc).Date()
	return time.Date(y, m, d, hour, 0, 0, 0, loc)
}

func gridBounds(day time.Time, loc *time.Location) (time.Time, time.Time) {
	return atHour(day, gridStartHour, loc), atHour(day, workEndHour, loc)
}

func workWindows(day time.Time, loc *time.Location) []span {
	if !isWorkday(day, loc) {
		return nil
	}
	return []span{
		{start: atHour(day, workStartHour, loc), end: atHour(day, lunchStartHour, loc)},
		{start: atHour(day, lunchEndHour, loc), end: atHour(day, workEndHour, loc)},
	}
}

func packCursor(now time.Time, loc *time.Location) time.Time {
	now = now.In(loc).Truncate(time.Second)
	for d := 0; d < 14; d++ {
		anchor := now.AddDate(0, 0, d)
		for _, window := range workWindows(anchor, loc) {
			if now.Before(window.start) {
				return window.start
			}
			if now.Before(window.end) {
				return now
			}
		}
	}
	return atHour(now.AddDate(0, 0, 1), workStartHour, loc)
}

func freeWorkSlots(now time.Time, events []EventOccurrence, loc *time.Location) []span {
	cursor := packCursor(now, loc)
	var free []span
	for day := 0; day < scheduleHorizonDays; day++ {
		anchor := cursor.AddDate(0, 0, day)
		for _, window := range workWindows(anchor, loc) {
			ws, we := window.start, window.end
			if cursor.After(ws) {
				ws = cursor
			}
			if !we.After(ws) {
				continue
			}
			free = append(free, complement(ws, we, busyInWindow(events, ws, we))...)
		}
	}
	return free
}

func busyInWindow(events []EventOccurrence, from, to time.Time) []span {
	var busy []span
	for _, event := range events {
		start, end, ok := clipInterval(event.StartsAt, event.EndsAt, from, to)
		if !ok {
			continue
		}
		busy = append(busy, span{start: start, end: end})
	}
	return mergeSpans(busy)
}

func busyInRange(events []EventOccurrence, from, to time.Time, loc *time.Location) []ScheduleBusy {
	var out []ScheduleBusy
	for _, event := range events {
		if !event.EndsAt.After(from) || !event.StartsAt.Before(to) {
			continue
		}
		y, m, d := event.StartsAt.In(loc).Date()
		for cursor := time.Date(y, m, d, 0, 0, 0, 0, loc); cursor.Before(event.EndsAt); cursor = cursor.AddDate(0, 0, 1) {
			gs, ge := gridBounds(cursor, loc)
			start, end, ok := clipInterval(event.StartsAt, event.EndsAt, gs, ge)
			if !ok {
				continue
			}
			start, end, ok = clipInterval(start, end, from, to)
			if !ok {
				continue
			}
			id := event.SeriesID
			busy := ScheduleBusy{StartsAt: start.UTC(), EndsAt: end.UTC(), Title: event.Title}
			if id != uuid.Nil {
				busy.SeriesID = &id
			}
			out = append(out, busy)
		}
	}
	out = append(out, lunchInRange(from, to, loc)...)
	sort.Slice(out, func(i, j int) bool {
		if out[i].StartsAt.Equal(out[j].StartsAt) {
			return out[i].Title < out[j].Title
		}
		return out[i].StartsAt.Before(out[j].StartsAt)
	})
	if out == nil {
		return []ScheduleBusy{}
	}
	return out
}

func lunchInRange(from, to time.Time, loc *time.Location) []ScheduleBusy {
	var out []ScheduleBusy
	y, m, d := from.In(loc).Date()
	for cursor := time.Date(y, m, d, 0, 0, 0, 0, loc); cursor.Before(to); cursor = cursor.AddDate(0, 0, 1) {
		if !isWorkday(cursor, loc) {
			continue
		}
		start, end, ok := clipInterval(atHour(cursor, lunchStartHour, loc), atHour(cursor, lunchEndHour, loc), from, to)
		if !ok {
			continue
		}
		out = append(out, ScheduleBusy{StartsAt: start.UTC(), EndsAt: end.UTC(), Title: lunchTitle})
	}
	return out
}

func mergeSpans(in []span) []span {
	if len(in) == 0 {
		return nil
	}
	sort.Slice(in, func(i, j int) bool {
		return in[i].start.Before(in[j].start)
	})
	out := []span{in[0]}
	for _, next := range in[1:] {
		last := &out[len(out)-1]
		if next.start.After(last.end) {
			out = append(out, next)
			continue
		}
		if next.end.After(last.end) {
			last.end = next.end
		}
	}
	return out
}

func complement(from, to time.Time, busy []span) []span {
	cursor := from
	var free []span
	for _, hole := range busy {
		if hole.start.After(cursor) {
			free = append(free, span{start: cursor, end: hole.start})
		}
		if hole.end.After(cursor) {
			cursor = hole.end
		}
		if !cursor.Before(to) {
			return free
		}
	}
	if to.After(cursor) {
		free = append(free, span{start: cursor, end: to})
	}
	return free
}

func cloneSpans(in []span) []span {
	out := make([]span, len(in))
	copy(out, in)
	return out
}

func packLane(items []Item, slots []span) []ScheduleBlock {
	var blocks []ScheduleBlock
	si := 0
	for _, item := range items {
		left := remainingSeconds(item)
		due := *item.DevDueAt
		for left > 0 && si < len(slots) {
			slot := slots[si]
			if !slot.end.After(slot.start) {
				si++
				continue
			}
			take := slot.end.Sub(slot.start)
			max := time.Duration(left) * time.Second
			if take > max {
				take = max
			}
			end := slot.start.Add(take)
			blocks = append(blocks, ScheduleBlock{
				ItemID:      item.ID,
				Title:       item.Title,
				ExternalKey: item.ExternalKey,
				StartsAt:    slot.start.UTC(),
				EndsAt:      end.UTC(),
				Late:        end.After(due),
			})
			left -= int64(take / time.Second)
			slots[si].start = end
		}
	}
	return blocks
}

func markContinuation(blocks []ScheduleBlock) []ScheduleBlock {
	counts := map[uuid.UUID]int{}
	for _, block := range blocks {
		counts[block.ItemID]++
	}
	seen := map[uuid.UUID]int{}
	for i := range blocks {
		id := blocks[i].ItemID
		seen[id]++
		blocks[i].Continued = seen[id] > 1
		blocks[i].Continues = seen[id] < counts[id]
	}
	return blocks
}

func filterBlocks(blocks []ScheduleBlock, from, to time.Time) []ScheduleBlock {
	var out []ScheduleBlock
	for _, block := range blocks {
		if !block.EndsAt.After(from) || !block.StartsAt.Before(to) {
			continue
		}
		out = append(out, block)
	}
	if out == nil {
		return []ScheduleBlock{}
	}
	return out
}

func paintLanes(blocks []ScheduleBlock, itemLane map[uuid.UUID]string, meta map[string]ScheduleLane) []ScheduleLane {
	grouped := map[string][]ScheduleBlock{}
	for _, block := range blocks {
		key := itemLane[block.ItemID]
		grouped[key] = append(grouped[key], block)
	}
	keys := make([]string, 0, len(grouped))
	for key := range grouped {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		a, b := meta[keys[i]], meta[keys[j]]
		if a.ProjectID == nil && b.ProjectID != nil {
			return false
		}
		if a.ProjectID != nil && b.ProjectID == nil {
			return true
		}
		if a.ProjectName == b.ProjectName {
			return keys[i] < keys[j]
		}
		return a.ProjectName < b.ProjectName
	})
	lanes := make([]ScheduleLane, 0, len(keys))
	for _, key := range keys {
		lane := meta[key]
		lane.Blocks = grouped[key]
		if len(lane.Blocks) == 0 {
			continue
		}
		lanes = append(lanes, lane)
	}
	if lanes == nil {
		return []ScheduleLane{}
	}
	return lanes
}

func scheduleOverflow(items []Item, blocks []ScheduleBlock) ScheduleOverflow {
	packed := map[uuid.UUID]int64{}
	late := map[uuid.UUID]int64{}
	for _, block := range blocks {
		packed[block.ItemID] += spanSeconds(block.StartsAt, block.EndsAt)
	}
	itemByID := map[uuid.UUID]Item{}
	for _, item := range items {
		itemByID[item.ID] = item
	}
	for _, block := range blocks {
		item, ok := itemByID[block.ItemID]
		if !ok || item.DevDueAt == nil {
			continue
		}
		late[block.ItemID] += lateSeconds(block.StartsAt, block.EndsAt, *item.DevDueAt)
	}
	var out ScheduleOverflow
	for _, item := range items {
		left := remainingSeconds(item) - packed[item.ID]
		if left < 0 {
			left = 0
		}
		over := late[item.ID] + left
		if over == 0 {
			continue
		}
		out.ItemCount++
		out.Seconds += over
		if item.DevDueAt == nil {
			continue
		}
		due := item.DevDueAt.UTC()
		if out.FirstDueAt == nil || due.Before(*out.FirstDueAt) {
			out.FirstDueAt = &due
		}
	}
	return out
}

func scheduleCapacity(free []span, blocks []ScheduleBlock, events []EventOccurrence, from, to time.Time, loc *time.Location) ScheduleCapacity {
	var out ScheduleCapacity
	for _, slot := range free {
		start, end, ok := clipInterval(slot.start, slot.end, from, to)
		if ok {
			out.FreeSeconds += spanSeconds(start, end)
		}
	}
	for _, block := range blocks {
		start, end, ok := clipInterval(block.StartsAt, block.EndsAt, from, to)
		if ok {
			out.PackedSeconds += spanSeconds(start, end)
		}
	}
	for _, event := range events {
		if !event.EndsAt.After(from) || !event.StartsAt.Before(to) {
			continue
		}
		y, m, d := event.StartsAt.In(loc).Date()
		for cursor := time.Date(y, m, d, 0, 0, 0, 0, loc); cursor.Before(event.EndsAt); cursor = cursor.AddDate(0, 0, 1) {
			gs, ge := gridBounds(cursor, loc)
			start, end, ok := clipInterval(event.StartsAt, event.EndsAt, gs, ge)
			if !ok {
				continue
			}
			start, end, ok = clipInterval(start, end, from, to)
			if ok {
				out.BusySeconds += spanSeconds(start, end)
			}
		}
	}
	return out
}

func spanSeconds(start, end time.Time) int64 {
	d := end.Sub(start)
	if d <= 0 {
		return 0
	}
	return int64(d / time.Second)
}

func lateSeconds(start, end, due time.Time) int64 {
	if !end.After(due) {
		return 0
	}
	lateStart := start
	if due.After(start) {
		lateStart = due
	}
	return spanSeconds(lateStart, end)
}
