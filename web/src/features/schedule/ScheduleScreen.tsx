import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { span } from '../../shared/format'
import { moscowWeek, moscowYmd, shiftWeeks } from '../../shared/moscow'
import { openTask } from '../../shared/taskOverlay'
import { Window } from '../../shared/Window'
import { NeedsFields } from './NeedsFields'
import type { ScheduleBlock, ScheduleBusy, ScheduleCapacity, ScheduleLane, ScheduleOverflow } from '../../types'
import './schedule.css'

const HOUR = 26
const START = 8
const HOURS = 11

function ymdOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function minutesOf(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

function endMinutes(iso: string, startMin: number): number {
  const value = minutesOf(iso)
  if (value === 0 || value < startMin) return 24 * 60
  return value
}

function weekKicker(days: string[]): string {
  const first = new Date(`${days[0]}T12:00:00+03:00`)
  const last = new Date(`${days[6]}T12:00:00+03:00`)
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }).format(d)
  return `${fmt(first)} – ${fmt(last)}`
}

function dayHead(ymd: string, today: string) {
  const date = new Date(`${ymd}T12:00:00+03:00`)
  return {
    today: ymd === today,
    week: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Moscow' }).format(date),
    num: new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/Moscow' }).format(date),
  }
}

function dueLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(iso))
}

function Block({
  row,
  color,
  running,
  onOpen,
}: {
  row: ScheduleBlock
  color: string
  running: boolean
  onOpen: (id: string) => void
}) {
  const start = minutesOf(row.startsAt)
  const end = endMinutes(row.endsAt, start)
  const top = ((start - START * 60) / 60) * HOUR
  const height = Math.max(((end - start) / 60) * HOUR, 8)
  const parallel = row.occupancy === 'parallel'
  const width = parallel ? `calc((100% - 12px) / 3)` : 'calc(100% - 6px)'
  const left = parallel ? `calc(3px + ${row.lane} * ((100% - 12px) / 3))` : '3px'
  const cls = [
    'sched-block',
    row.late ? 'late' : '',
    row.continued ? 'continued' : '',
    running ? 'running' : '',
    parallel ? 'parallel' : 'solo',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      style={{
        top,
        height,
        left,
        width,
        right: 'auto',
        background: `color-mix(in srgb, ${color || 'var(--accent)'} 18%, transparent)`,
        borderColor: `color-mix(in srgb, ${color || 'var(--accent)'} 45%, transparent)`,
      }}
      onClick={() => onOpen(row.itemId)}
    >
      {row.externalKey ? <span className="mono">{row.externalKey}</span> : null}
      <strong>
        {row.title}
        {row.continues ? '…' : ''}
      </strong>
    </button>
  )
}

function Hatch({ row, onOpen }: { row: ScheduleBusy; onOpen: (id: string) => void }) {
  const start = minutesOf(row.startsAt)
  const end = endMinutes(row.endsAt, start)
  const top = ((start - START * 60) / 60) * HOUR
  const height = Math.max(((end - start) / 60) * HOUR, 6)
  const style = { top, height }
  if (row.seriesId) {
    return (
      <button
        type="button"
        className="sched-busy tap"
        style={style}
        title={row.title}
        onClick={() => onOpen(row.seriesId!)}
      />
    )
  }
  return <i className="sched-busy" style={style} title={row.title} />
}

function NowLine({ today, ymd }: { today: string; ymd: string }) {
  if (ymd !== today) return null
  const top = ((minutesOf(new Date().toISOString()) - START * 60) / 60) * HOUR
  if (top < 0 || top > HOURS * HOUR) return null
  return <i className="sched-now" style={{ top }} />
}

function Lane({
  lane,
  days,
  busy,
  delay,
  today,
  runningIds,
  onOpen,
  onBusy,
}: {
  lane: ScheduleLane
  days: string[]
  busy: ScheduleBusy[]
  delay: number
  today: string
  runningIds: Set<string>
  onOpen: (id: string) => void
  onBusy: (id: string) => void
}) {
  const color = lane.projectColor || 'var(--accent)'
  return (
    <div className="sched-lane" style={{ '--d': delay } as CSSProperties}>
      <div className="sched-lane-meta">
        <i className="sched-swatch" style={{ background: color }} />
        <strong>{lane.projectName}</strong>
        <ol className="sched-hours" aria-hidden>
          {Array.from({ length: HOURS }, (_, i) => (
            <li key={i} style={{ height: HOUR }}>
              {String(START + i).padStart(2, '0')}
            </li>
          ))}
        </ol>
      </div>
      {days.map((ymd) => (
        <div key={ymd} className="sched-day" style={{ height: HOURS * HOUR }}>
          {busy.filter((row) => ymdOf(row.startsAt) === ymd).map((row) => (
            <Hatch key={`${row.startsAt}-${row.title}`} row={row} onOpen={onBusy} />
          ))}
          <NowLine today={today} ymd={ymd} />
          {lane.blocks
            .filter((row) => ymdOf(row.startsAt) === ymd)
            .map((row) => (
              <Block
                key={`${row.itemId}-${row.startsAt}`}
                row={row}
                color={color}
                running={runningIds.has(row.itemId)}
                onOpen={onOpen}
              />
            ))}
        </div>
      ))}
    </div>
  )
}

function Pressure({ overflow, capacity }: { overflow: ScheduleOverflow; capacity: ScheduleCapacity }) {
  const total = capacity.packedSeconds + capacity.freeSeconds
  const packedPct = total > 0 ? Math.min(100, (capacity.packedSeconds / total) * 100) : 0
  return (
    <div className="sched-pressure">
      <div className="sched-cap" aria-hidden>
        <i style={{ width: `${packedPct}%` }} />
      </div>
      <p className="sched-cap-meta">
        {span(capacity.packedSeconds)} packed · {span(capacity.freeSeconds)} free
        {capacity.busySeconds > 0 ? ` · ${span(capacity.busySeconds)} meetings` : ''}
      </p>
      {overflow.itemCount > 0 ? (
        <p className="sched-overflow">
          {overflow.itemCount} late · {span(overflow.seconds)} over
          {overflow.firstDueAt ? ` · due ${dueLabel(overflow.firstDueAt)}` : ''}
        </p>
      ) : null}
    </div>
  )
}

export function ScheduleScreen() {
  const navigate = useNavigate()
  const gantt = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState(() => new Date())
  const [kind, setKind] = useState<'work' | 'followup'>('work')
  const week = useMemo(() => moscowWeek(anchor), [anchor])
  const today = moscowYmd()
  const intervals = useQuery({
    queryKey: ['intervals'],
    queryFn: api.intervals,
    refetchInterval: 10_000,
  })
  const running = intervals.data ?? []
  const report = useQuery({
    queryKey: ['schedule', kind, week.from, week.to],
    queryFn: () => api.schedule(week.from, week.to, kind),
    refetchInterval: running.length > 0 ? 10_000 : false,
  })
  const lanes = report.data?.lanes ?? []
  const unplanned = report.data?.unplanned ?? []
  const busy = report.data?.busy ?? []
  const runningIds = new Set(running.map((row) => row.itemId))

  return (
    <Window
      className="sched-window"
      kicker={weekKicker(week.days)}
      title={kind === 'followup' ? 'Follow-up' : 'Schedule'}
      actions={
        <div className="sched-tabs">
          <button type="button" className={kind === 'work' ? 'ghost on' : 'ghost'} onClick={() => setKind('work')}>
            Work
          </button>
          <button type="button" className={kind === 'followup' ? 'ghost on' : 'ghost'} onClick={() => setKind('followup')}>
            Follow-up
          </button>
          <button type="button" className="ghost" aria-label="Previous week" onClick={() => setAnchor((d) => shiftWeeks(d, -1))}>
            ‹
          </button>
          <button type="button" className="ghost" aria-label="This week" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button
            type="button"
            className="ghost"
            aria-label="Now"
            onClick={() => gantt.current?.querySelector('.sched-now')?.scrollIntoView({ block: 'center', inline: 'nearest' })}
          >
            Now
          </button>
          <button type="button" className="ghost" aria-label="Next week" onClick={() => setAnchor((d) => shiftWeeks(d, 1))}>
            ›
          </button>
        </div>
      }
    >
      <div className={unplanned.length > 0 ? 'sched-split' : 'sched-split solo'}>
        <div className="sched-gantt">
          <div className="sched-gantt-core" ref={gantt}>
            {report.isLoading ? <p className="muted">Loading…</p> : null}
            {report.isError ? <p className="error">{report.error.message}</p> : null}
            {!report.isLoading && !report.isError ? (
              <>
                {report.data ? <Pressure overflow={report.data.overflow} capacity={report.data.capacity} /> : null}
                <div className="sched-head">
                  <span />
                  {week.days.map((ymd) => {
                    const head = dayHead(ymd, today)
                    return (
                      <div key={ymd} className={head.today ? 'sched-head-day today' : 'sched-head-day'}>
                        <small>{head.week}</small>
                        <strong>{head.num}</strong>
                      </div>
                    )
                  })}
                </div>
                {lanes.length === 0 ? (
                  <>
                    <div className="sched-lane sched-lane-empty">
                      <div className="sched-lane-meta" />
                      {week.days.map((ymd) => (
                        <div key={ymd} className="sched-day" style={{ height: HOURS * HOUR }}>
                          {busy.filter((row) => ymdOf(row.startsAt) === ymd).map((row) => (
                            <Hatch key={`${row.startsAt}-${row.title}`} row={row} onOpen={(id) => navigate(`/events/${id}`)} />
                          ))}
                          <NowLine today={today} ymd={ymd} />
                        </div>
                      ))}
                    </div>
                    <p className="sched-empty muted">No scheduled work this week.</p>
                  </>
                ) : (
                  lanes.map((lane, i) => (
                    <Lane
                      key={lane.projectId ?? 'none'}
                      lane={lane}
                      days={week.days}
                      busy={busy}
                      delay={i}
                      today={today}
                      runningIds={runningIds}
                      onOpen={(id) => openTask(navigate, id)}
                      onBusy={(id) => navigate(`/events/${id}`)}
                    />
                  ))
                )}
              </>
            ) : null}
          </div>
        </div>
        <NeedsFields rows={unplanned} kind={kind} />
      </div>
    </Window>
  )
}
