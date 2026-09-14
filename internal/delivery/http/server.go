package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/application"
	"github.com/pchkauu/want-brief/internal/domain"
)

const sessionCookie = "wb_session"

type Server struct {
	App        *application.Service
	CORSOrigin string
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/logout", s.withAuth(s.logout))
	mux.HandleFunc("GET /api/me", s.withAuth(s.me))

	mux.HandleFunc("GET /api/projects", s.withAuth(s.listProjects))
	mux.HandleFunc("POST /api/projects", s.withAuth(s.createProject))
	mux.HandleFunc("PATCH /api/projects/{id}", s.withAuth(s.patchProject))
	mux.HandleFunc("DELETE /api/projects/{id}", s.withAuth(s.deleteProject))

	mux.HandleFunc("GET /api/sources", s.withAuth(s.listSources))
	mux.HandleFunc("POST /api/sources", s.withAuth(s.createSource))
	mux.HandleFunc("PATCH /api/sources/{id}", s.withAuth(s.patchSource))
	mux.HandleFunc("DELETE /api/sources/{id}", s.withAuth(s.deleteSource))
	mux.HandleFunc("POST /api/sources/{id}/sync", s.withAuth(s.syncSource))

	mux.HandleFunc("GET /api/items", s.withAuth(s.listItems))
	mux.HandleFunc("POST /api/items", s.withAuth(s.createItem))
	mux.HandleFunc("PATCH /api/items/{id}", s.withAuth(s.patchItem))
	mux.HandleFunc("DELETE /api/items/{id}", s.withAuth(s.deleteItem))

	mux.HandleFunc("GET /api/notes", s.withAuth(s.listNotes))
	mux.HandleFunc("POST /api/notes", s.withAuth(s.createNote))
	mux.HandleFunc("PATCH /api/notes/{id}", s.withAuth(s.patchNote))
	mux.HandleFunc("DELETE /api/notes/{id}", s.withAuth(s.deleteNote))

	mux.HandleFunc("GET /api/intervals", s.withAuth(s.listIntervals))
	mux.HandleFunc("POST /api/intervals", s.withAuth(s.startInterval))
	mux.HandleFunc("POST /api/intervals/{id}/stop", s.withAuth(s.stopInterval))

	mux.HandleFunc("POST /api/stress", s.withAuth(s.createStress))
	mux.HandleFunc("GET /api/load", s.withAuth(s.load))

	return s.cors(mux)
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := s.CORSOrigin
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil {
			writeError(w, domain.ErrUnauthorized)
			return
		}
		if err := s.App.Authenticate(r.Context(), cookie.Value); err != nil {
			writeError(w, err)
			return
		}
		next(w, r)
	}
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	token, err := s.App.Login(r.Context(), body.Password)
	if err != nil {
		writeError(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	cookie, _ := r.Cookie(sessionCookie)
	if cookie != nil {
		_ = s.App.Logout(r.Context(), cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Path: "/", MaxAge: -1})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) me(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	items, err := s.App.ListProjects(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name            string  `json:"name"`
		Color           string  `json:"color"`
		TargetHoursWeek float64 `json:"targetHoursWeek"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	project, err := s.App.CreateProject(r.Context(), body.Name, body.Color, body.TargetHoursWeek)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (s *Server) patchProject(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var body struct {
		Name            *string  `json:"name"`
		Color           *string  `json:"color"`
		TargetHoursWeek *float64 `json:"targetHoursWeek"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	project, err := s.App.PatchProject(r.Context(), id, body.Name, body.Color, body.TargetHoursWeek)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.App.DeleteProject(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listSources(w http.ResponseWriter, r *http.Request) {
	items, err := s.App.ListSources(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createSource(w http.ResponseWriter, r *http.Request) {
	var body application.SourceInput
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	source, err := s.App.CreateSource(r.Context(), body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, source)
}

func (s *Server) patchSource(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var body application.SourceInput
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	source, err := s.App.PatchSource(r.Context(), id, body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, source)
}

func (s *Server) deleteSource(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.App.DeleteSource(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) syncSource(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	n, err := s.App.SyncSource(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"upserted": n})
}

func (s *Server) listItems(w http.ResponseWriter, r *http.Request) {
	filter := domain.ItemFilter{}
	q := r.URL.Query()
	if v := q.Get("sourceId"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
		filter.SourceID = &id
	}
	if v := q.Get("projectId"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
		filter.ProjectID = &id
	}
	if v := q.Get("kind"); v != "" {
		kind, err := domain.ParseItemKind(v)
		if err != nil {
			writeError(w, err)
			return
		}
		filter.Kind = &kind
	}
	if v := q.Get("status"); v != "" {
		status, err := domain.ParseItemStatus(v)
		if err != nil {
			writeError(w, err)
			return
		}
		filter.Status = &status
	}
	items, err := s.App.ListItems(r.Context(), filter)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createItem(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title     string  `json:"title"`
		Kind      string  `json:"kind"`
		ProjectID *string `json:"projectId"`
		Urgent    bool    `json:"urgent"`
		Important bool    `json:"important"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	var projectID *uuid.UUID
	if body.ProjectID != nil && *body.ProjectID != "" {
		id, err := uuid.Parse(*body.ProjectID)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
		projectID = &id
	}
	item, err := s.App.CreateItem(r.Context(), body.Title, body.Kind, projectID, body.Urgent, body.Important)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) patchItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var body struct {
		Title     *string `json:"title"`
		Status    *string `json:"status"`
		Kind      *string `json:"kind"`
		ProjectID *string `json:"projectId"`
		Urgent    *bool   `json:"urgent"`
		Important *bool   `json:"important"`
		Stress    *int    `json:"stress"`
		DueAt     *string `json:"dueAt"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	patch := application.ItemPatch{
		Title:     body.Title,
		Status:    body.Status,
		Kind:      body.Kind,
		Urgent:    body.Urgent,
		Important: body.Important,
		Stress:    body.Stress,
	}
	if body.ProjectID != nil {
		if *body.ProjectID == "" {
			patch.ClearProj = true
		} else {
			pid, err := uuid.Parse(*body.ProjectID)
			if err != nil {
				writeError(w, domain.ErrInvalid)
				return
			}
			patch.ProjectID = &pid
		}
	}
	if body.Stress != nil && *body.Stress == 0 {
		patch.Stress = nil
		patch.ClearStr = true
	}
	if body.DueAt != nil {
		if *body.DueAt == "" {
			patch.ClearDue = true
		} else {
			due, err := time.Parse(time.RFC3339, *body.DueAt)
			if err != nil {
				writeError(w, domain.ErrInvalid)
				return
			}
			patch.DueAt = &due
		}
	}
	item, err := s.App.PatchItem(r.Context(), id, patch)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) deleteItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.App.DeleteItem(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listNotes(w http.ResponseWriter, r *http.Request) {
	var itemID *uuid.UUID
	if v := r.URL.Query().Get("itemId"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
		itemID = &id
	}
	notes, err := s.App.ListNotes(r.Context(), itemID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, notes)
}

func (s *Server) createNote(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Body   string  `json:"body"`
		ItemID *string `json:"itemId"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	var itemID *uuid.UUID
	if body.ItemID != nil && *body.ItemID != "" {
		id, err := uuid.Parse(*body.ItemID)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
		itemID = &id
	}
	note, err := s.App.CreateNote(r.Context(), body.Body, itemID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, note)
}

func (s *Server) patchNote(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var body struct {
		Body string `json:"body"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	note, err := s.App.PatchNote(r.Context(), id, body.Body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, note)
}

func (s *Server) deleteNote(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.App.DeleteNote(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listIntervals(w http.ResponseWriter, r *http.Request) {
	items, err := s.App.ListOpenIntervals(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) startInterval(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ItemID string `json:"itemId"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	id, err := uuid.Parse(body.ItemID)
	if err != nil {
		writeError(w, domain.ErrInvalid)
		return
	}
	interval, err := s.App.StartInterval(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, interval)
}

func (s *Server) stopInterval(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	interval, err := s.App.StopInterval(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, interval)
}

func (s *Server) createStress(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Level  int     `json:"level"`
		ItemID *string `json:"itemId"`
		At     *string `json:"at"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	var itemID *uuid.UUID
	if body.ItemID != nil && *body.ItemID != "" {
		id, err := uuid.Parse(*body.ItemID)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
		itemID = &id
	}
	var at *time.Time
	if body.At != nil && *body.At != "" {
		parsed, err := time.Parse(time.RFC3339, *body.At)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
		at = &parsed
	}
	log, err := s.App.CreateStress(r.Context(), body.Level, itemID, at)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, log)
}

func (s *Server) load(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var from, to time.Time
	var err error
	if v := q.Get("from"); v != "" {
		from, err = time.Parse(time.RFC3339, v)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
	}
	if v := q.Get("to"); v != "" {
		to, err = time.Parse(time.RFC3339, v)
		if err != nil {
			writeError(w, domain.ErrInvalid)
			return
		}
	}
	report, err := s.App.Load(r.Context(), from, to)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func parseID(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		return uuid.Nil, domain.ErrInvalid
	}
	return id, nil
}

func decodeJSON(r *http.Request, dest any) error {
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dest); err != nil {
		return domain.ErrInvalid
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	msg := "internal error"
	switch {
	case errors.Is(err, domain.ErrUnauthorized):
		status = http.StatusUnauthorized
		msg = "unauthorized"
	case errors.Is(err, domain.ErrNotFound):
		status = http.StatusNotFound
		msg = "not found"
	case errors.Is(err, domain.ErrInvalid):
		status = http.StatusBadRequest
		msg = err.Error()
	case errors.Is(err, domain.ErrConflict), errors.Is(err, domain.ErrSourceReadOnly):
		status = http.StatusConflict
		msg = err.Error()
	case errors.Is(err, domain.ErrForbidden), errors.Is(err, domain.ErrUnsupported), errors.Is(err, domain.ErrNoToken):
		status = http.StatusForbidden
		msg = err.Error()
	}
	if status == http.StatusInternalServerError && strings.Contains(err.Error(), "HTTP") {
		status = http.StatusBadGateway
		msg = "source provider error"
	}
	writeJSON(w, status, map[string]string{"error": msg})
}
