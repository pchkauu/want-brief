package todoist

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pchkauu/want-brief/internal/domain"
)

type Gateway struct {
	Client *http.Client
}

func New() *Gateway {
	return &Gateway{Client: &http.Client{Timeout: 25 * time.Second}}
}

type task struct {
	ID          string `json:"id"`
	Content     string `json:"content"`
	IsCompleted bool   `json:"is_completed"`
	Due         *struct {
		Date string `json:"date"`
	} `json:"due"`
	Priority int `json:"priority"`
}

func (g *Gateway) Probe(ctx context.Context, source domain.Source, token string) error {
	base := strings.TrimRight(source.BaseURL, "/")
	if base == "" {
		base = "https://api.todoist.com"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/rest/v2/projects", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := g.Client.Do(req)
	if err != nil {
		return fmt.Errorf("todoist probe: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return fmt.Errorf("todoist probe: HTTP %d", resp.StatusCode)
	}
	return nil
}

func (g *Gateway) Pull(ctx context.Context, source domain.Source, token string) ([]domain.RemoteItem, error) {
	base := strings.TrimRight(source.BaseURL, "/")
	if base == "" {
		base = "https://api.todoist.com"
	}
	endpoint := base + "/rest/v2/tasks"
	if filter := strings.TrimSpace(source.QueryFilter); filter != "" {
		endpoint += "?filter=" + url.QueryEscape(filter)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := g.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("todoist tasks: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("todoist tasks: HTTP %d", resp.StatusCode)
	}
	var tasks []task
	if err := json.Unmarshal(raw, &tasks); err != nil {
		return nil, fmt.Errorf("todoist decode: %w", err)
	}
	out := make([]domain.RemoteItem, 0, len(tasks))
	for _, task := range tasks {
		item := domain.RemoteItem{
			ExternalKey:   task.ID,
			Title:         task.Content,
			Status:        domain.StatusBacklog,
			HintImportant: task.Priority >= 3,
			HintUrgent:    task.Priority == 4,
		}
		if task.IsCompleted {
			item.Status = domain.StatusDone
		}
		if task.Due != nil && task.Due.Date != "" {
			if due, err := parseDue(task.Due.Date); err == nil {
				item.DueAt = &due
				if !due.After(time.Now().UTC()) {
					item.HintUrgent = true
				}
			}
		}
		out = append(out, item)
	}
	return out, nil
}

func parseDue(raw string) (time.Time, error) {
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return t, nil
	}
	return time.Parse(time.RFC3339, raw)
}
