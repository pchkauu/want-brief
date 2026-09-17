import { CalendarBlank, CaretRight } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { span } from '../../shared/format'
import { moscowWeek, moscowYmd, shiftWeeks } from '../../shared/moscow'
import { openTask } from '../../shared/taskOverlay'
import { Window } from '../../shared/Window'
import { NeedsFields } from './NeedsFields'
import { NowDeck, type DeckProject } from './NowDeck'
import { ScheduleTable } from './ScheduleTable'
import { clock, covering, dayHead, pickNow, todayBlocks } from './now'
import type { ScheduleBlock, ScheduleBusy, ScheduleCapacity, ScheduleLane, ScheduleOverflow } from '../../types'
import './schedule.css'

const HOUR = 48
const START = 8
const HOURS = 11
const DAY_HEIGHT = HOURS * HOUR
const VIEW_KEY = 'schedule.view'

type View = 'calendar' | 'list'

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'calendar'
  } catch {
    return 'calendar'
  }
}

function storeView(view: View) {
  try {
    window.localStorage.setItem(VIEW_KEY, view)
  } catch {
    // storage unavailable, keep in memory only
  }
}

function hasMeeting(busy: ScheduleBusy[], ymd: string): boolean {
  return busy.some((row) => row.seriesId && ymdOf(row.startsAt) === ymd)
}

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
  return `${fmt(first)} - ${fmt(last)}`
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
      if (head.today) return 'minmax(12rem, 2fr)'
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
  focus,
  tracks,
  onOpen,
}: {
  row: ScheduleBlock
  color: string
  running: boolean
  focus: boolean
  tracks: number
  onOpen: (id: string) => void
}) {
  const start = minutesOf(row.startsAt)
  const end = endMinutes(row.endsAt, start)
  const top = ((start - START * 60) / 60) * HOUR
  const height = Math.max(((end - start) / 60) * HOUR, 34)
  const short = height < HOUR
  const split = row.occupancy === 'parallel' && tracks > 1
  const cls = [
    'sched-block',
    row.late ? 'late' : '',
    row.continued ? 'continued' : '',
    row.continues ? 'continues' : '',
    running ? 'running' : '',
    focus ? 'focus' : '',
    short ? 'short' : '',
    split ? 'parallel' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const label = [row.title, row.externalKey].filter(Boolean).join(' ')
  const fill = row.late
    ? `color-mix(in srgb, var(--danger) 22%, transparent)`
    : `color-mix(in srgb, ${color || 'var(--accent)'} 18%, transparent)`
  const border = focus
    ? `color-mix(in srgb, var(--accent-2) 80%, transparent)`
    : row.late
      ? `color-mix(in srgb, var(--danger) 28%, transparent)`
      : `color-mix(in srgb, ${color || 'var(--accent)'} 45%, transparent)`
  const style = {
    top,
    height,
    background: fill,
    borderColor: border,
    ...(split ? { '--track': row.lane, '--tracks': tracks } : {}),
  } as CSSProperties
  return (
    <button type="button" className={cls} title={label} style={style} onClick={() => onOpen(row.itemId)}>
      <span className="sched-block-line">
        <strong>{row.title}</strong>
        <CaretRight size={12} weight="light" aria-hidden />
      </span>
      {!short && row.externalKey ? <span className="mono">{row.externalKey}</span> : null}
      <span className="sched-block-flags">
        {row.continued ? <span className="sched-chip">continues</span> : null}
        {row.late ? <span className="sched-chip late">late</span> : null}
        {running ? <span className="sched-chip live">in time</span> : null}
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
        {clock(new Date().toISOString())}
        {edge ? ' - grid 08-18' : ''}
      </span>
    </i>
  )
}

// layoutDay returns the day's blocks and how many parallel tracks the day uses.
// Solo blocks span the column; parallel blocks split it by track when more than one is in use.
function layoutDay(blocks: ScheduleBlock[], ymd: string): { rows: ScheduleBlock[]; tracks: number } {
  const rows = blocks.filter((row) => ymdOf(row.startsAt) === ymd)
  const tracks = rows.reduce((max, row) => (row.occupancy === 'parallel' ? Math.max(max, row.lane + 1) : max), 0)
  return { rows, tracks }
}

function Lane({
  lane,
  days,
  busy,
  today,
  runningIds,
  focusIds,
  onOpen,
  onBusy,
}: {
  lane: ScheduleLane
  days: string[]
  busy: ScheduleBusy[]
  today: string
  runningIds: Set<string>
  focusIds: Set<string>
  onOpen: (id: string) => void
  onBusy: (id: string) => void
}) {
  const color = lane.projectColor || 'var(--accent)'
  return (
    <div className="sched-lane">
      <div className="sched-lane-name">
        <i className="sched-swatch" style={{ background: color }} />
        <strong>{lane.projectName}</strong>
      </div>
      {days.map((ymd) => {
        const { rows, tracks } = layoutDay(lane.blocks, ymd)
        const empty = rows.length === 0 && !dayHead(ymd, today).weekend && !hasMeeting(busy, ymd)
        return (
          <div key={ymd} className={dayTone(ymd, today)} style={{ height: DAY_HEIGHT }}>
            {ymd === today ? <HoursRail /> : null}
            {busy.filter((row) => ymdOf(row.startsAt) === ymd).map((row) => (
              <Hatch key={`${row.startsAt}-${row.title}`} row={row} onOpen={onBusy} />
            ))}
            <NowLine today={today} ymd={ymd} />
            {rows.map((row) => (
              <Block
                key={`${row.itemId}-${row.startsAt}`}
                row={row}
                color={color}
                running={runningIds.has(row.itemId)}
                focus={focusIds.has(`${row.itemId}-${row.startsAt}`)}
                tracks={tracks}
                onOpen={onOpen}
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
}: {
  overflow: ScheduleOverflow
  capacity: ScheduleCapacity
  meetings: number
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
          {!dayHead(ymd, today).weekend && !hasMeeting(busy, ymd) ? <p className="sched-noslot">No slots</p> : null}
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
  const [view, setView] = useState<View>(readView)
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const week = useMemo(() => moscowWeek(anchor), [anchor])
  const today = moscowYmd(new Date(tick))
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
  const todays = todayBlocks(lanes, today)
  const pick = pickNow(todays, tick)
  const focusIds = new Set(covering(todays, tick).map((row) => `${row.itemId}-${row.startsAt}`))
  const projectByItem = new Map<string, DeckProject>()
  const titleByItem = new Map<string, string>()
  for (const lane of lanes) {
    for (const row of lane.blocks) {
      projectByItem.set(row.itemId, { name: lane.projectName, color: lane.projectColor || 'var(--accent)' })
      titleByItem.set(row.itemId, row.externalKey ? `${row.externalKey} ${row.title}` : row.title)
    }
  }

  function switchView(next: View) {
    setView(next)
    storeView(next)
  }

  function scrollNow() {
    const target = view === 'list' ? '.sched-table-day.today' : '.sched-now'
    gantt.current?.querySelector(target)?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }

  return (
    <Window
      className="sched-window"
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
            <button type="button" className={view === 'calendar' ? 'ghost on' : 'ghost'} onClick={() => switchView('calendar')}>
              Calendar
            </button>
            <button type="button" className={view === 'list' ? 'ghost on' : 'ghost'} onClick={() => switchView('list')}>
              List
            </button>
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
      <NowDeck
        pick={pick}
        loading={report.isLoading && !report.data}
        running={running}
        lateCount={report.data?.overflow.itemCount ?? 0}
        lateId={lateId}
        projectOf={(id) => projectByItem.get(id)}
        titleOf={(id) => titleByItem.get(id)}
        showNext={view === 'calendar'}
        onOpen={(id) => openTask(navigate, id)}
        onNextWeek={() => setAnchor((d) => shiftWeeks(d, 1))}
      />
      <div className={unplanned.length > 0 ? 'sched-split' : 'sched-split solo'}>
        <div className="sched-gantt">
          <div className={collapseWeekend ? 'sched-gantt-core compact' : 'sched-gantt-core'} ref={gantt} style={gridStyle}>
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
                  <Pressure overflow={report.data.overflow} capacity={report.data.capacity} meetings={meetingCount(busy)} />
                ) : null}
                <p className="sched-week-range">{range}</p>
                {view === 'list' ? (
                  <ScheduleTable
                    lanes={lanes}
                    busy={busy}
                    days={week.days}
                    today={today}
                    runningIds={runningIds}
                    focusIds={focusIds}
                    projectOf={(id) => projectByItem.get(id)}
                    onOpen={(id) => openTask(navigate, id)}
                    onBusy={(id) => navigate(`/events/${id}`)}
                  />
                ) : (
                  <>
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
                          focusIds={focusIds}
                          onOpen={(id) => openTask(navigate, id)}
                          onBusy={(id) => navigate(`/events/${id}`)}
                        />
                      ))
                    )}
                    <p className="sched-readonly">Packed layout, not a drag calendar</p>
                  </>
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
