# Want Brief

Personal load organizer: one inbox for Jira, Todoist, and local work, Eisenhower priorities, parallel time tracking, stress, and notes.

## Run

Live data (`wantbrief`):

```bash
cp .env.example .env
make up
make api
```

```bash
make web
```

Open http://127.0.0.1:5173.

Scratch (`wantbrief_dev`) in two more terminals:

```bash
make api-dev
```

```bash
make web-dev
```

Open http://127.0.0.1:5174.

Sign in with `BOOTSTRAP_PASSWORD` from `.env.example` (`wantbrief`). Both stacks can run at once.

## Sources

Settings accepts up to three Jira Cloud sites (PAT as Bearer, or `email:apiToken` for basic auth) and one Todoist REST token. Sync is read-only. Default Jira JQL:

`assignee = currentUser() AND statusCategory != Done`

## Time

You can run several timers at once. **Allocated** sums every interval. **Wall clock** merges overlaps so parallel work does not inflate the day.
