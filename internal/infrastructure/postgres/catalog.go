package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/pchkauu/want-brief/internal/domain"
)

func (s *Store) Count(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) CreateUser(ctx context.Context, user domain.User) (domain.User, error) {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, password_hash, created_at)
		VALUES ($1, $2, $3)
		RETURNING id, password_hash, created_at
	`, user.ID, user.PasswordHash, user.CreatedAt).Scan(&user.ID, &user.PasswordHash, &user.CreatedAt)
	return user, err
}

func (s *Store) FirstUser(ctx context.Context) (domain.User, error) {
	var user domain.User
	err := s.pool.QueryRow(ctx, `
		SELECT id, password_hash, created_at FROM users ORDER BY created_at LIMIT 1
	`).Scan(&user.ID, &user.PasswordHash, &user.CreatedAt)
	return user, mapErr(err)
}

func (s *Store) CreateSession(ctx context.Context, session domain.Session) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, session.ID, session.UserID, session.TokenHash, session.ExpiresAt, session.CreatedAt)
	return err
}

func (s *Store) GetByTokenHash(ctx context.Context, tokenHash string) (domain.Session, error) {
	var session domain.Session
	err := s.pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, created_at
		FROM sessions WHERE token_hash = $1
	`, tokenHash).Scan(&session.ID, &session.UserID, &session.TokenHash, &session.ExpiresAt, &session.CreatedAt)
	return session, mapErr(err)
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *Store) DeleteExpired(ctx context.Context, now time.Time) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= $1`, now)
	return err
}

type UserRepo struct{ *Store }

func (r UserRepo) Count(ctx context.Context) (int, error) { return r.Store.Count(ctx) }
func (r UserRepo) Create(ctx context.Context, user domain.User) (domain.User, error) {
	return r.Store.CreateUser(ctx, user)
}
func (r UserRepo) First(ctx context.Context) (domain.User, error) { return r.Store.FirstUser(ctx) }

type SessionRepo struct{ *Store }

func (r SessionRepo) Create(ctx context.Context, session domain.Session) error {
	return r.Store.CreateSession(ctx, session)
}
func (r SessionRepo) GetByTokenHash(ctx context.Context, tokenHash string) (domain.Session, error) {
	return r.Store.GetByTokenHash(ctx, tokenHash)
}
func (r SessionRepo) Delete(ctx context.Context, tokenHash string) error {
	return r.Store.DeleteSession(ctx, tokenHash)
}
func (r SessionRepo) DeleteExpired(ctx context.Context, now time.Time) error {
	return r.Store.DeleteExpired(ctx, now)
}

func (s *Store) GetProject(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	var p domain.Project
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, color, target_hours_week, created_at, updated_at
		FROM projects WHERE id = $1
	`, id).Scan(&p.ID, &p.Name, &p.Color, &p.TargetHoursWeek, &p.CreatedAt, &p.UpdatedAt)
	return p, mapErr(err)
}

func (s *Store) ListProjects(ctx context.Context) ([]domain.Project, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, color, target_hours_week, created_at, updated_at
		FROM projects ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Project
	for rows.Next() {
		var p domain.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Color, &p.TargetHoursWeek, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) CreateProject(ctx context.Context, p domain.Project) (domain.Project, error) {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO projects (id, name, color, target_hours_week, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, name, color, target_hours_week, created_at, updated_at
	`, p.ID, p.Name, p.Color, p.TargetHoursWeek, p.CreatedAt, p.UpdatedAt).
		Scan(&p.ID, &p.Name, &p.Color, &p.TargetHoursWeek, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

func (s *Store) UpdateProject(ctx context.Context, p domain.Project) (domain.Project, error) {
	err := s.pool.QueryRow(ctx, `
		UPDATE projects
		SET name=$2, color=$3, target_hours_week=$4, updated_at=$5
		WHERE id=$1
		RETURNING id, name, color, target_hours_week, created_at, updated_at
	`, p.ID, p.Name, p.Color, p.TargetHoursWeek, p.UpdatedAt).
		Scan(&p.ID, &p.Name, &p.Color, &p.TargetHoursWeek, &p.CreatedAt, &p.UpdatedAt)
	return p, mapErr(err)
}

func (s *Store) DeleteProject(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM projects WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

type ProjectRepo struct{ *Store }

func (r ProjectRepo) Get(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	return r.Store.GetProject(ctx, id)
}
func (r ProjectRepo) List(ctx context.Context) ([]domain.Project, error) {
	return r.Store.ListProjects(ctx)
}
func (r ProjectRepo) Create(ctx context.Context, project domain.Project) (domain.Project, error) {
	return r.Store.CreateProject(ctx, project)
}
func (r ProjectRepo) Update(ctx context.Context, project domain.Project) (domain.Project, error) {
	return r.Store.UpdateProject(ctx, project)
}
func (r ProjectRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.Store.DeleteProject(ctx, id)
}

func (s *Store) GetSource(ctx context.Context, id uuid.UUID) (domain.Source, error) {
	var src domain.Source
	var kind string
	err := s.pool.QueryRow(ctx, `
		SELECT id, kind, name, base_url, token_sealed, query_filter, last_sync_at, created_at, updated_at
		FROM sources WHERE id=$1
	`, id).Scan(&src.ID, &kind, &src.Name, &src.BaseURL, &src.TokenSealed, &src.QueryFilter, &src.LastSyncAt, &src.CreatedAt, &src.UpdatedAt)
	src.Kind = domain.SourceKind(kind)
	src.HasToken = src.TokenSealed != ""
	return src, mapErr(err)
}

func (s *Store) ListSources(ctx context.Context) ([]domain.Source, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, kind, name, base_url, token_sealed, query_filter, last_sync_at, created_at, updated_at
		FROM sources ORDER BY kind, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Source
	for rows.Next() {
		var src domain.Source
		var kind string
		if err := rows.Scan(&src.ID, &kind, &src.Name, &src.BaseURL, &src.TokenSealed, &src.QueryFilter, &src.LastSyncAt, &src.CreatedAt, &src.UpdatedAt); err != nil {
			return nil, err
		}
		src.Kind = domain.SourceKind(kind)
		src.HasToken = src.TokenSealed != ""
		out = append(out, src)
	}
	return out, rows.Err()
}

func (s *Store) CreateSource(ctx context.Context, src domain.Source) (domain.Source, error) {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO sources (id, kind, name, base_url, token_sealed, query_filter, last_sync_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, kind, name, base_url, token_sealed, query_filter, last_sync_at, created_at, updated_at
	`, src.ID, string(src.Kind), src.Name, src.BaseURL, src.TokenSealed, src.QueryFilter, src.LastSyncAt, src.CreatedAt, src.UpdatedAt).
		Scan(&src.ID, &src.Kind, &src.Name, &src.BaseURL, &src.TokenSealed, &src.QueryFilter, &src.LastSyncAt, &src.CreatedAt, &src.UpdatedAt)
	src.HasToken = src.TokenSealed != ""
	return src, err
}

func (s *Store) UpdateSource(ctx context.Context, src domain.Source) (domain.Source, error) {
	err := s.pool.QueryRow(ctx, `
		UPDATE sources
		SET name=$2, base_url=$3, token_sealed=$4, query_filter=$5, last_sync_at=$6, updated_at=$7
		WHERE id=$1
		RETURNING id, kind, name, base_url, token_sealed, query_filter, last_sync_at, created_at, updated_at
	`, src.ID, src.Name, src.BaseURL, src.TokenSealed, src.QueryFilter, src.LastSyncAt, src.UpdatedAt).
		Scan(&src.ID, &src.Kind, &src.Name, &src.BaseURL, &src.TokenSealed, &src.QueryFilter, &src.LastSyncAt, &src.CreatedAt, &src.UpdatedAt)
	src.HasToken = src.TokenSealed != ""
	return src, mapErr(err)
}

func (s *Store) DeleteSource(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM sources WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (s *Store) LocalSource(ctx context.Context) (domain.Source, error) {
	var src domain.Source
	err := s.pool.QueryRow(ctx, `
		SELECT id, kind, name, base_url, token_sealed, query_filter, last_sync_at, created_at, updated_at
		FROM sources WHERE kind='local' ORDER BY created_at LIMIT 1
	`).Scan(&src.ID, &src.Kind, &src.Name, &src.BaseURL, &src.TokenSealed, &src.QueryFilter, &src.LastSyncAt, &src.CreatedAt, &src.UpdatedAt)
	return src, mapErr(err)
}

type SourceRepo struct{ *Store }

func (r SourceRepo) Get(ctx context.Context, id uuid.UUID) (domain.Source, error) {
	return r.Store.GetSource(ctx, id)
}
func (r SourceRepo) List(ctx context.Context) ([]domain.Source, error) {
	return r.Store.ListSources(ctx)
}
func (r SourceRepo) Create(ctx context.Context, source domain.Source) (domain.Source, error) {
	return r.Store.CreateSource(ctx, source)
}
func (r SourceRepo) Update(ctx context.Context, source domain.Source) (domain.Source, error) {
	return r.Store.UpdateSource(ctx, source)
}
func (r SourceRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.Store.DeleteSource(ctx, id)
}
func (r SourceRepo) Local(ctx context.Context) (domain.Source, error) {
	return r.Store.LocalSource(ctx)
}

func scanItem(scanner interface {
	Scan(dest ...any) error
}) (domain.Item, error) {
	var item domain.Item
	var kind, status, sourceKind string
	err := scanner.Scan(
		&item.ID, &item.SourceID, &item.ExternalKey, &item.Title, &status, &kind,
		&item.ProjectID, &item.Urgent, &item.Important, &item.Stress, &item.DueAt,
		&item.CreatedAt, &item.UpdatedAt, &item.SourceName, &sourceKind, &item.ProjectName, &item.ProjectColor,
	)
	item.Status = domain.ItemStatus(status)
	item.Kind = domain.ItemKind(kind)
	item.SourceKind = domain.SourceKind(sourceKind)
	return item.WithQuadrant(), err
}

const itemSelect = `
SELECT
	i.id, i.source_id, i.external_key, i.title, i.status, i.kind,
	i.project_id, i.urgent, i.important, i.stress, i.due_at,
	i.created_at, i.updated_at,
	s.name, s.kind,
	COALESCE(p.name, ''), COALESCE(p.color, '')
FROM items i
JOIN sources s ON s.id = i.source_id
LEFT JOIN projects p ON p.id = i.project_id
`

func (s *Store) GetItem(ctx context.Context, id uuid.UUID) (domain.Item, error) {
	row := s.pool.QueryRow(ctx, itemSelect+` WHERE i.id=$1`, id)
	item, err := scanItem(row)
	return item, mapErr(err)
}

func (s *Store) ListItems(ctx context.Context, filter domain.ItemFilter) ([]domain.Item, error) {
	query := itemSelect + ` WHERE 1=1`
	args := []any{}
	n := 1
	if filter.SourceID != nil {
		query += fmt.Sprintf(` AND i.source_id=$%d`, n)
		args = append(args, *filter.SourceID)
		n++
	}
	if filter.ProjectID != nil {
		query += fmt.Sprintf(` AND i.project_id=$%d`, n)
		args = append(args, *filter.ProjectID)
		n++
	}
	if filter.Kind != nil {
		query += fmt.Sprintf(` AND i.kind=$%d`, n)
		args = append(args, string(*filter.Kind))
		n++
	}
	if filter.Status != nil {
		query += fmt.Sprintf(` AND i.status=$%d`, n)
		args = append(args, string(*filter.Status))
		n++
	}
	if filter.OpenOnly {
		query += ` AND i.status='open'`
	}
	query += ` ORDER BY i.updated_at DESC`
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Item
	for rows.Next() {
		item, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Store) CreateItem(ctx context.Context, item domain.Item) (domain.Item, error) {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO items (
			id, source_id, external_key, title, status, kind, project_id,
			urgent, important, stress, due_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, item.ID, item.SourceID, item.ExternalKey, item.Title, string(item.Status), string(item.Kind),
		item.ProjectID, item.Urgent, item.Important, item.Stress, item.DueAt, item.CreatedAt, item.UpdatedAt)
	if err != nil {
		return domain.Item{}, err
	}
	return s.GetItem(ctx, item.ID)
}

func (s *Store) UpdateItem(ctx context.Context, item domain.Item) (domain.Item, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE items SET
			title=$2, status=$3, kind=$4, project_id=$5, urgent=$6, important=$7,
			stress=$8, due_at=$9, updated_at=$10
		WHERE id=$1
	`, item.ID, item.Title, string(item.Status), string(item.Kind), item.ProjectID, item.Urgent, item.Important,
		item.Stress, item.DueAt, item.UpdatedAt)
	if err != nil {
		return domain.Item{}, err
	}
	if tag.RowsAffected() == 0 {
		return domain.Item{}, domain.ErrNotFound
	}
	return s.GetItem(ctx, item.ID)
}

func (s *Store) DeleteItem(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM items WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (s *Store) UpsertSynced(ctx context.Context, item domain.Item) (domain.Item, error) {
	var id uuid.UUID
	err := s.pool.QueryRow(ctx, `
		INSERT INTO items (
			id, source_id, external_key, title, status, kind, project_id,
			urgent, important, stress, due_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (source_id, external_key) WHERE external_key <> ''
		DO UPDATE SET
			title = EXCLUDED.title,
			status = EXCLUDED.status,
			due_at = EXCLUDED.due_at,
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`, uuid.New(), item.SourceID, item.ExternalKey, item.Title, string(item.Status), string(item.Kind),
		item.ProjectID, item.Urgent, item.Important, item.Stress, item.DueAt, item.CreatedAt, item.UpdatedAt).Scan(&id)
	if err != nil {
		return domain.Item{}, err
	}
	return s.GetItem(ctx, id)
}

type ItemRepo struct{ *Store }

func (r ItemRepo) Get(ctx context.Context, id uuid.UUID) (domain.Item, error) {
	return r.Store.GetItem(ctx, id)
}
func (r ItemRepo) List(ctx context.Context, filter domain.ItemFilter) ([]domain.Item, error) {
	return r.Store.ListItems(ctx, filter)
}
func (r ItemRepo) Create(ctx context.Context, item domain.Item) (domain.Item, error) {
	return r.Store.CreateItem(ctx, item)
}
func (r ItemRepo) Update(ctx context.Context, item domain.Item) (domain.Item, error) {
	return r.Store.UpdateItem(ctx, item)
}
func (r ItemRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.Store.DeleteItem(ctx, id)
}
func (r ItemRepo) UpsertSynced(ctx context.Context, item domain.Item) (domain.Item, error) {
	return r.Store.UpsertSynced(ctx, item)
}
