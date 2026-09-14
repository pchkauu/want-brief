# Want Brief

Personal load organizer: one inbox for Jira, Todoist, and local work, Eisenhower priorities, parallel time tracking, stress, and notes.

## Run

```bash
cp .env.example .env
make up
make api
```

In another terminal:

```bash
make web
```

Open http://127.0.0.1:5173 and sign in with `BOOTSTRAP_PASSWORD` from `.env.example` (`wantbrief`).

## Sources

Settings accepts up to three Jira Cloud sites (PAT as Bearer, or `email:apiToken` for basic auth) and one Todoist REST token. Sync is read-only. Default Jira JQL:

`assignee = currentUser() AND statusCategory != Done`

## Time

You can run several timers at once. **Allocated** sums every interval. **Wall clock** merges overlaps so parallel work does not inflate the day.
