package jira

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

type searchRequest struct {
	JQL        string   `json:"jql"`
	Fields     []string `json:"fields"`
	MaxResults int      `json:"maxResults"`
}

type searchResponse struct {
	Issues []struct {
		Key    string `json:"key"`
		Fields struct {
			Summary  string `json:"summary"`
			DueDate  string `json:"duedate"`
			Priority *struct {
				Name string `json:"name"`
			} `json:"priority"`
			Status struct {
				StatusCategory struct {
					Key string `json:"key"`
				} `json:"statusCategory"`
			} `json:"status"`
		} `json:"fields"`
	} `json:"issues"`
}

func (g *Gateway) Pull(ctx context.Context, source domain.Source, token string) ([]domain.RemoteItem, error) {
	base := strings.TrimRight(source.BaseURL, "/")
	if base == "" {
		return nil, fmt.Errorf("%w: jira base url", domain.ErrInvalid)
	}
	jql := source.QueryFilter
	if jql == "" {
		jql = domain.DefaultQuery(domain.SourceJira)
	}
	body, err := json.Marshal(searchRequest{
		JQL:        jql,
		Fields:     []string{"summary", "status", "priority", "duedate"},
		MaxResults: 100,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/rest/api/3/search/jql", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	applyAuth(req, token)

	resp, err := g.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("jira search: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("jira search: HTTP %d", resp.StatusCode)
	}
	var parsed searchResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("jira decode: %w", err)
	}
	out := make([]domain.RemoteItem, 0, len(parsed.Issues))
	for _, issue := range parsed.Issues {
		item := domain.RemoteItem{
			ExternalKey: issue.Key,
			Title:       issue.Fields.Summary,
			Status:      domain.StatusOpen,
		}
		if issue.Fields.Status.StatusCategory.Key == "done" {
			item.Status = domain.StatusDone
		}
		if issue.Fields.Priority != nil {
			name := strings.ToLower(issue.Fields.Priority.Name)
			item.HintImportant = name == "highest" || name == "high"
			item.HintUrgent = name == "highest" || name == "blocker"
		}
		if issue.Fields.DueDate != "" {
			if due, err := time.Parse("2006-01-02", issue.Fields.DueDate); err == nil {
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

func applyAuth(req *http.Request, token string) {
	if email, rest, ok := strings.Cut(token, ":"); ok && email != "" && rest != "" {
		req.SetBasicAuth(email, rest)
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
}
