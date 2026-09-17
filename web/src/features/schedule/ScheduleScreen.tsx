import { CalendarBlank, CaretRight } from '@phosphor-icons/react'
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

const HOUR = 48
const START = 8
const HOURS = 11
const DAY_HEIGHT = HOURS * HOUR

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

function clockLabel(iso = new Date().toISOString()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function weekKicker(days: string[]): string {
  const first = new Date(`${days[0]}T12:00:00+03:00`)
  const last = new Date(`${days[6]}T12:00:00+03:00`)
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }).format(d)
  return `${fmt(first)} - ${fmt(last)}`
}

function dayHead(ymd: string, today: string) {
  const date = new Date(`${ymd}T12:00:00+03:00`)
  const weekday = date.getDay()
  return {
    today: ymd === today,
    weekend: weekday === 0 || weekday === 6,
    week: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Moscow' }).format(date),
    num: new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/Moscow' }).format(date),
  }
}

function dayTone(ymd: string, today: string): string {
  const head = dayHead(ymd, today)
  return ['sched-day', head.today ? 'today' : '', !head.today && head.weekend ? 'weekend' : '']
    .filter(Boolean)
    .join(' ')
}

function weekColumns(days: string[], today: string, collapseWeekend: boolean): string {
  return days
    .map((ymd) => {
      const head = dayHead(ymd, today)
      if (head.today) return 'minmax(7.5rem, 1.35fr)'
      if (head.weekend && collapseWeekend) return 'minmax(3.2rem, 0.42fr)'
      return 'minmax(4.4rem, 1fr)'
    })
    .join(' ')
}

function weekendHasTasks(lanes: ScheduleLane[], days: string[]): boolean {
  const weekend = new Set(days.filter((ymd) => dayHead(ymd, '').weekend))
  return lanes.some((lane) => lane.blocks.some((row) => weekend.has(ymdOf(row.startsAt))))
}

function firstLateId(lanes: ScheduleLane[]): string | null {
  const late = lanes.flatMap((lane) => lane.blocks.filter((row) => row.late))
  if (late.length === 0) return null
  late.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return late[0].itemId
}

function meetingCount(busy: ScheduleBusy[]): number {
  return busy.filter((row) => row.seriesId).length
}

function HoursRail() {
  return (
    <ol className="sched-hours" aria-hidden>
      {Array.from({ length: HOURS }, (_, i) => (
        <li key={i}>{String(START + i).padStart(2, '0')}</li>
      ))}
    </ol>
  )
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
  extra,
  expanded,
  stackIndex,
  onOpen,
  onToggleStack,
}: {
  row: ScheduleBlock
  color: string
  running: boolean
  extra: number
  expanded: boolean
  stackIndex: number
  onOpen: (id: string) => void
  onToggleStack?: () => void
}) {
  const start = minutesOf(row.startsAt)
  const end = endMinutes(row.endsAt, start)
  const top = ((start - START * 60) / 60) * HOUR + (expanded ? stackIndex * 24 : 0)
  const height = Math.max(((end - start) / 60) * HOUR, 34)
  const short = height < HOUR
  const cls = [
    'sched-block',
    row.late ? 'late' : '',
    row.continued ? 'continued' : '',
    row.continues ? 'continues' : '',
    running ? 'running' : '',
    short ? 'short' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const label = [row.title, row.externalKey].filter(Boolean).join(' ')
  const fill = row.late
    ? `color-mix(in srgb, var(--danger) 22%, transparent)`
    : `color-mix(in srgb, ${color || 'var(--accent)'} 18%, transparent)`
  const border = row.late
    ? `color-mix(in srgb, var(--danger) 55%, transparent)`
    : `color-mix(in srgb, ${color || 'var(--accent)'} 45%, transparent)`
  return (
    <button
      type="button"
      className={cls}
      title={label}
      style={{ top, height, background: fill, borderColor: border }}
      onClick={() => onOpen(row.itemId)}
    >
      <span className="sched-block-line">
        <strong>{row.title}</strong>
        {short && row.externalKey ? <span className="mono">{row.externalKey}</span> : null}
        <CaretRight size={12} weight="light" aria-hidden />
      </span>
      {!short && row.externalKey ? <span className="mono">{row.externalKey}</span> : null}
      <span className="sched-block-flags">
        {row.continued || row.continues ? <span className="sched-chip">continues</span> : null}
        {row.late ? <span className="sched-chip late">late</span> : null}
        {running ? <span className="sched-chip live">in time</span> : null}
        {extra > 0 ? (
          <span
            className="sched-chip more"
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation()
              onToggleStack?.()
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              onToggleStack?.()
            }}
          >
            +{extra}
          </span>
        ) : null}
        {expanded ? (
          <span
            className="sched-chip more"
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation()
              onToggleStack?.()
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              onToggleStack?.()
            }}
          >
            Hide
          </span>
        ) : null}
      </span>
    </button>
  )
}

function Hatch({ row, onOpen }: { row: ScheduleBusy; onOpen: (id: string) => void }) {
  const start = minutesOf(row.startsAt)
  const end = endMinutes(row.endsAt, start)
  const top = ((start - START * 60) / 60) * HOUR
  const height = Math.max(((end - start) / 60) * HOUR, 16)
  const style = { top, height }
  const body = (
    <>
      {row.seriesId ? <CalendarBlank size={12} weight="light" aria-hidden /> : null}
      <span>{row.title}</span>
    </>
  )
  if (row.seriesId) {
    return (
      <button
        type="button"
        className="sched-busy meeting"
        style={style}
        title={row.title}
        onClick={() => onOpen(row.seriesId!)}
      >
        {body}
      </button>
    )
  }
  return (
    <i className="sched-busy" style={style}>
      {body}
    </i>
  )
}

function NowLine({ today, ymd }: { today: string; ymd: string }) {
  if (ymd !== today) return null
  const raw = ((minutesOf(new Date().toISOString()) - START * 60) / 60) * HOUR
  const top = Math.min(DAY_HEIGHT, Math.max(0, raw))
  const edge = raw < 0 || raw > DAY_HEIGHT
  const below = raw < 14
  return (
    <i className={below ? 'sched-now below' : 'sched-now'} style={{ top }}>
      <span>
        {clockLabel()}
        {edge ? ' - grid 08-18' : ''}
      </span>
    </i>
  )
}

type Stacked = { row: ScheduleBlock; extra: number; expanded: boolean; hourKey: string; stackIndex: number }

function stackDay(blocks: ScheduleBlock[], ymd: string, openHour: string | null, runningIds: Set<string>): Stacked[] {
  const day = blocks.filter((row) => ymdOf(row.startsAt) === ymd)
  const out: Stacked[] = []
  const parallel = new Map<number, ScheduleBlock[]>()
  for (const row of day) {
    if (row.occupancy !== 'parallel') {
      out.push({ row, extra: 0, expanded: false, hourKey: '', stackIndex: 0 })
      continue
    }
    const key = minutesOf(row.startsAt)
    const group = parallel.get(key) ?? []
    group.push(row)
    parallel.set(key, group)
  }
  for (const [start, group] of parallel) {
    const hourKey = `${ymd}-${start}`
    const expanded = openHour === hourKey
    if (expanded || group.length === 1) {
      group.forEach((row, index) => {
        out.push({ row, extra: 0, expanded: expanded && group.length > 1, hourKey, stackIndex: index })
      })
      continue
    }
    const preferred =
      group.find((row) => runningIds.has(row.itemId)) ??
      group.find((row) => row.late) ??
      group.find((row) => row.lane === 0) ??
      group[0]
    out.push({ row: preferred, extra: group.length - 1, expanded: false, hourKey, stackIndex: 0 })
  }
  return out
}

function Lane({
  lane,
  days,
  busy,
  today,
  runningIds,
  openHour,
  onOpen,
  onBusy,
  onToggleHour,
}: {
  lane: ScheduleLane
  days: string[]
  busy: ScheduleBusy[]
  today: string
  runningIds: Set<string>
  openHour: string | null
  onOpen: (id: string) => void
  onBusy: (id: string) => void
  onToggleHour: (key: string) => void
}) {
  const color = lane.projectColor || 'var(--accent)'
  return (
    <div className="sched-lane">
      <div className="sched-lane-name">
        <i className="sched-swatch" style={{ background: color }} />
        <strong>{lane.projectName}</strong>
      </div>
      {days.map((ymd) => {
        const rows = stackDay(lane.blocks, ymd, openHour, runningIds)
        const empty = rows.length === 0 && !dayHead(ymd, today).weekend
        return (
          <div key={ymd} className={dayTone(ymd, today)} style={{ height: DAY_HEIGHT }}>
            {ymd === today ? <HoursRail /> : null}
            {busy.filter((row) => ymdOf(row.startsAt) === ymd).map((row) => (
              <Hatch key={`${row.startsAt}-${row.title}`} row={row} onOpen={onBusy} />
            ))}
            <NowLine today={today} ymd={ymd} />
            {rows.map((item) => (
              <Block
                key={`${item.row.itemId}-${item.row.startsAt}`}
                row={item.row}
                color={color}
                running={runningIds.has(item.row.itemId)}
                extra={item.extra}
                expanded={item.expanded}
                stackIndex={item.stackIndex}
                onOpen={onOpen}
                onToggleStack={item.hourKey ? () => onToggleHour(item.hourKey) : undefined}
              />
            ))}
            {empty ? <p className="sched-noslot">No slots</p> : null}
          </div>
        )
      })}
    </div>
  )
}

function Pressure({
  overflow,
  capacity,
  meetings,
  lateId,
  onOpenLate,
}: {
  overflow: ScheduleOverflow
  capacity: ScheduleCapacity
  meetings: number
  lateId: string | null
  onOpenLate: (id: string) => void
}) {
  const packed = capacity.packedSeconds
  const free = capacity.freeSeconds
  const over = overflow.seconds
  const total = packed + free + over
  const packedPct = total > 0 ? Math.min(100, (packed / total) * 100) : 0
  const overPct = total > 0 ? Math.min(100 - packedPct, (over / total) * 100) : 0
  return (
    <div className="sched-pressure">
      <div className="sched-cap" aria-hidden>
        <i className="packed" style={{ width: `${packedPct}%` }} />
        {overPct > 0 ? <i className="over" style={{ width: `${overPct}%` }} /> : null}
      </div>
      <p className="sched-cap-meta">
        {overflow.itemCount > 0 && overflow.firstDueAt
          ? `Will not fit: ${span(overflow.seconds)} past ${dueLabel(overflow.firstDueAt)}`
          : overflow.itemCount > 0
            ? `Will not fit: ${span(overflow.seconds)}`
            : `This week: ${meetings} meetings, ${span(free)} free for tasks`}
      </p>
      {overflow.itemCount > 0 ? (
        <p className="sched-overflow">
          {overflow.itemCount} late
          <button type="button" className="ghost" disabled={!lateId} onClick={() => lateId && onOpenLate(lateId)}>
            Open
          </button>
        </p>
      ) : null}
      <ul className="sched-legend">
        <li className="late">Late</li>
        <li className="live">In time</li>
        <li className="parallel">Parallel</li>
      </ul>
    </div>
  )
}

function DayCells({ days, today, busy, onBusy }: { days: string[]; today: string; busy: ScheduleBusy[]; onBusy: (id: string) => void }) {
  return (
    <>
      {days.map((ymd) => (
        <div key={ymd} className={dayTone(ymd, today)} style={{ height: DAY_HEIGHT }}>
          {ymd === today ? <HoursRail /> : null}
          {busy.filter((row) => ymdOf(row.startsAt) === ymd).map((row) => (
            <Hatch key={`${row.startsAt}-${row.title}`} row={row} onOpen={onBusy} />
          ))}
          <NowLine today={today} ymd={ymd} />
          {!dayHead(ymd, today).weekend ? <p className="sched-noslot">No slots</p> : null}
        </div>
      ))}
    </>
  )
}

export function ScheduleScreen() {
  const navigate = useNavigate()
  const gantt = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState(() => new Date())
  const [kind, setKind] = useState<'work' | 'followup'>('work')
  const [openHour, setOpenHour] = useState<string | null>(null)
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
  const collapseWeekend = !weekendHasTasks(lanes, week.days)
  const cols = weekColumns(week.days, today, collapseWeekend)
  const gridStyle = { '--sched-cols': cols } as CSSProperties
  const lateId = firstLateId(lanes)
  const range = weekKicker(week.days)

  function toggleHour(key: string) {
    setOpenHour((current) => (current === key ? null : key))
  }

  function scrollNow() {
    gantt.current?.querySelector('.sched-now')?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }

  return (
    <Window
      className="sched-window"
      kicker={range}
      title={kind === 'followup' ? 'Follow-up' : 'Schedule'}
      actions={
        <div className="sched-actions">
          <div className="sched-cluster">
            <div className="sched-tabs">
              <button type="button" className={kind === 'work' ? 'ghost on' : 'ghost'} onClick={() => setKind('work')}>
                Work
              </button>
              <button
                type="button"
                className={kind === 'followup' ? 'ghost on' : 'ghost'}
                onClick={() => setKind('followup')}
              >
                Follow-up
              </button>
            </div>
            <p className="sched-pack-hint">{kind === 'work' ? 'Dev due' : 'Review and QA due'}</p>
          </div>
          <div className="sched-tabs">
            <button type="button" className="ghost" aria-label="Previous week" onClick={() => setAnchor((d) => shiftWeeks(d, -1))}>
              ‹
            </button>
            <button type="button" className="ghost" aria-label="This week" onClick={() => setAnchor(new Date())}>
              This week
            </button>
            <button type="button" className="ghost" aria-label="Next week" onClick={() => setAnchor((d) => shiftWeeks(d, 1))}>
              ›
            </button>
          </div>
          <div className="sched-tabs">
            <button type="button" className="ghost" aria-label="Now" onClick={scrollNow}>
              Now
            </button>
          </div>
        </div>
      }
    >
      <div className={unplanned.length > 0 ? 'sched-split' : 'sched-split solo'}>
        <div className="sched-gantt">
          <div className="sched-gantt-core" ref={gantt} style={gridStyle}>
            {report.isError ? <p className="error">{report.error.message}</p> : null}
            {report.isLoading && !report.data ? (
              <div className="sched-skel" aria-hidden>
                <p className="sched-week-range">{range}</p>
                <div className="sched-head">
                  {week.days.map((ymd) => (
                    <div key={ymd} className="sched-head-day" />
                  ))}
                </div>
                <div className="sched-lane">
                  <div className="sched-lane-name" />
                  {week.days.map((ymd) => (
                    <div key={ymd} className="sched-day" style={{ height: DAY_HEIGHT }} />
                  ))}
                </div>
              </div>
            ) : report.data || !report.isError ? (
              <>
                {report.data ? (
                  <Pressure
                    overflow={report.data.overflow}
                    capacity={report.data.capacity}
                    meetings={meetingCount(busy)}
                    lateId={lateId}
                    onOpenLate={(id) => openTask(navigate, id)}
                  />
                ) : null}
                <p className="sched-week-range">{range}</p>
                <div className="sched-head">
                  {week.days.map((ymd) => {
                    const head = dayHead(ymd, today)
                    return (
                      <div
                        key={ymd}
                        className={['sched-head-day', head.today ? 'today' : '', !head.today && head.weekend ? 'weekend' : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <small>{head.week}</small>
                        <strong>{head.num}</strong>
                        {head.today ? <em>Today</em> : null}
                      </div>
                    )
                  })}
                </div>
                {lanes.length === 0 ? (
                  <>
                    <div className="sched-lane sched-lane-empty">
                      <div className="sched-lane-name" />
                      <DayCells days={week.days} today={today} busy={busy} onBusy={(id) => navigate(`/events/${id}`)} />
                    </div>
                    <p className="sched-empty muted">No scheduled work this week.</p>
                  </>
                ) : (
                  lanes.map((lane) => (
                    <Lane
                      key={lane.projectId ?? 'none'}
                      lane={lane}
                      days={week.days}
                      busy={busy}
                      today={today}
                      runningIds={runningIds}
                      openHour={openHour}
                      onOpen={(id) => openTask(navigate, id)}
                      onBusy={(id) => navigate(`/events/${id}`)}
                      onToggleHour={toggleHour}
                    />
                  ))
                )}
                <p className="sched-readonly">Packed layout, not a drag calendar</p>
              </>
            ) : null}
          </div>
        </div>
        <NeedsFields rows={unplanned} kind={kind} />
      </div>
    </Window>
  )
}
