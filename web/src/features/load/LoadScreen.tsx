import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Window } from '../../shared/Window'
import { hours } from '../../shared/format'

export function LoadScreen() {
  const load = useQuery({ queryKey: ['load'], queryFn: () => api.load() })
  const report = load.data
  if (!report) {
    return (
      <Window title="analytics">
        <p className="muted">Loading load report…</p>
      </Window>
    )
  }

  const max = Math.max(1, ...report.byProject.map((row) => row.allocatedSeconds))
  const ranked = [...report.byItem].sort((a, b) => b.allocatedSeconds - a.allocatedSeconds)

  return (
    <Window title="analytics">
      <div className="stats">
        <article>
          <small>Allocated</small>
          <strong>{hours(report.allocatedSeconds)}</strong>
          <span>sum of every timer</span>
        </article>
        <article>
          <small>Wall clock</small>
          <strong>{hours(report.wallSeconds)}</strong>
          <span>merged overlapping time</span>
        </article>
        <article>
          <small>Stress avg</small>
          <strong>{report.averageStress ? report.averageStress.toFixed(1) : '—'}</strong>
          <span>last 7 days</span>
        </article>
      </div>
      <h3>Projects</h3>
      <ul className="bars">
        {report.byProject.map((row) => (
          <li key={row.projectId ?? row.name}>
            <span>{row.name}</span>
            <b style={{ width: `${(row.allocatedSeconds / max) * 100}%`, background: row.color }} />
            <small>
              {hours(row.allocatedSeconds)}
              {row.targetHoursWeek ? ` / ${row.targetHoursWeek}h plan` : ''}
            </small>
          </li>
        ))}
      </ul>
      <h3>Where time went</h3>
      <ol className="list">
        {ranked.slice(0, 12).map((row) => (
          <li key={row.itemId}>
            <div className="grow">
              <strong>{row.title}</strong>
              <small>
                {row.kind} · {row.projectName || 'unassigned'}
              </small>
            </div>
            <span className="mono">{hours(row.allocatedSeconds)}</span>
          </li>
        ))}
      </ol>
    </Window>
  )
}
