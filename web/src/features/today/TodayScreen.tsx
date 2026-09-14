import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api'
import { Window } from '../../shared/Window'
import { elapsed } from '../../shared/format'
import type { Item } from '../../types'

export function TodayScreen() {
  const queryClient = useQueryClient()
  const items = useQuery({ queryKey: ['items'], queryFn: () => api.items({ status: 'open' }) })
  const intervals = useQuery({ queryKey: ['intervals'], queryFn: api.intervals, refetchInterval: 1000 })
  const [stress, setStress] = useState(3)
  const logStress = useMutation({
    mutationFn: (level: number) => api.createStress(level),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['load'] }),
  })

  const focus = (items.data ?? [])
    .filter((item) => item.urgent && item.important)
    .slice(0, 6)
  const running = intervals.data ?? []
  const lead = running[0]
  const leadItem = (items.data ?? []).find((row) => row.id === lead?.itemId)

  return (
    <Window title="Today">
      <section className="hero">
        <div>
          <small>{running.length ? 'Running now' : 'Focus'}</small>
          <strong className="mono">
            {lead ? elapsed(lead.startedAt) : `${focus.length}`}
          </strong>
        </div>
        <p>
          {lead
            ? leadItem?.title ?? 'Timer on'
            : focus.length
              ? 'Open items in Do. Start a timer when ready.'
              : 'Nothing in Do. Open Priorities and pick the next brief.'}
        </p>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h3>Do now</h3>
          <ItemList items={focus} empty="Nothing in the Do quadrant. Open Priorities." />
        </section>
        <section className="panel">
          <h3>Running</h3>
          {running.length === 0 ? <p className="muted">No active timers. Open Focus.</p> : null}
          <ul className="list">
            {running.map((interval) => {
              const item = (items.data ?? []).find((row) => row.id === interval.itemId)
              return (
                <li key={interval.id}>
                  <strong>{item?.title ?? interval.itemId}</strong>
                  <span className="mono">{elapsed(interval.startedAt)}</span>
                </li>
              )
            })}
          </ul>
          <h3>Day stress</h3>
          <div className="row">
            <input
              type="range"
              min={1}
              max={5}
              value={stress}
              onChange={(e) => setStress(Number(e.target.value))}
            />
            <span>{stress}</span>
            <button type="button" onClick={() => logStress.mutate(stress)}>
              Log
            </button>
          </div>
        </section>
      </div>
    </Window>
  )
}

function ItemList({ items, empty }: { items: Item[]; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item.id}>
          <i className="dot" style={{ background: item.projectColor || 'var(--accent)' }} />
          <div>
            <strong>{item.title}</strong>
            <small>
              {item.sourceName} · {item.kind}
            </small>
          </div>
        </li>
      ))}
    </ul>
  )
}
