import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { hours } from '../../shared/format'
import { moscowRange, type LoadPeriod } from '../../shared/moscow'

const periods: { id: LoadPeriod; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

export function ProjectPeriods() {
  const [period, setPeriod] = useState<LoadPeriod>('day')
  const load = useQuery({
    queryKey: ['load', period],
    queryFn: () => {
      const bounds = moscowRange(period)
      return api.load(bounds.from, bounds.to)
    },
  })
  const rows = load.data?.byProject ?? []
  const max = Math.max(1, ...rows.map((row) => row.allocatedSeconds))

  return (
    <section className="panel">
      <h3>Projects</h3>
      <div className="period-tabs">
        {periods.map((item) => (
          <button
            key={item.id}
            type="button"
            className={period === item.id ? 'chip on' : 'chip'}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <p className="muted">No tracked time in this window.</p> : null}
      <ul className="bars">
        {rows.map((row) => (
          <li key={row.projectId ?? row.name}>
            <span>{row.name}</span>
            <b style={{ width: `${(row.allocatedSeconds / max) * 100}%`, background: row.color }} />
            <small>{hours(row.allocatedSeconds)}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}
