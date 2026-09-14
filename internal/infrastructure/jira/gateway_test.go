package jira

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pchkauu/want-brief/internal/domain"
)

func TestPullMapsIssues(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/rest/api/3/search/jql" {
			t.Fatalf("path %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer pat-1" {
			t.Fatalf("auth %s", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "WB-1",
					"fields": map[string]any{
						"summary":  "Ship inbox",
						"duedate":  "2020-01-01",
						"priority": map[string]string{"name": "High"},
						"status": map[string]any{
							"statusCategory": map[string]string{"key": "indeterminate"},
						},
					},
				},
			},
		})
	}))
	t.Cleanup(server.Close)

	g := New()
	g.Client = server.Client()
	items, err := g.Pull(t.Context(), domain.Source{BaseURL: server.URL}, "pat-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ExternalKey != "WB-1" {
		t.Fatalf("%+v", items)
	}
	if !items[0].HintUrgent || !items[0].HintImportant {
		t.Fatalf("hints %+v", items[0])
	}
}
