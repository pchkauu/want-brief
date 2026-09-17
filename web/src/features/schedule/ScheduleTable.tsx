import { CalendarBlank } from '@phosphor-icons/react'
import { span } from '../../shared/format'
import { moscowYmd } from '../../shared/moscow'
import type { ScheduleBlock, ScheduleBusy, ScheduleLane } from '../../types'
import type { DeckProject } from './NowDeck'
import { blocksOn, clock, dayHead } from './now'

type Props = {
  lanes: ScheduleLane[]
  busy: ScheduleBusy[]
  days: string[]
  today: string
  runningIds: Set<string>
  focusIds: Set<string>
  projectOf: (itemId: string) => DeckProject | undefined
  onOpen: (id: string) => void
  onBusy: (id: string) => void
}

type Row = { kind: 'block'; block: ScheduleBlock } | { kind: 'meeting'; busy: ScheduleBusy }

const COLUMNS = 6

function seconds(startsAt: string, endsAt: string): number {
  return Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 1000))
}

function startOf(row: Row): string {
  return row.kind === 'block' ? row.block.startsAt : row.busy.startsAt
}

function dayRows(lanes: ScheduleLane[], busy: ScheduleBusy[], ymd: string): Row[] {
  const blocks: Row[] = blocksOn(lanes, ymd).map((block) => ({ kind: 'block', block }))
  const meetings: Row[] = busy
    .filter((row) => row.seriesId && moscowYmd(new Date(row.startsAt)) === ymd)
    .map((row) => ({ kind: 'meeting', busy: row }))
  return [...blocks, ...meetings].sort((a, b) => startOf(a).localeCompare(startOf(b)))
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function summary(rows: Row[]): string {
  const blocks = rows.filter((row) => row.kind === 'block')
  const meetings = rows.length - blocks.length
  const total = blocks.reduce((sum, row) => (row.kind === 'block' ? sum + seconds(row.block.startsAt, row.block.endsAt) : sum), 0)
  const parts: string[] = []
  if (blocks.length > 0) parts.push(plural(blocks.length, 'block', 'blocks'), span(total))
  if (meetings > 0) parts.push(plural(meetings, 'meeting', 'meetings'))
  return parts.join(', ')
}

function BlockRow({
  block,
  project,
  running,
  focus,
  onOpen,
}: {
  block: ScheduleBlock
  project?: DeckProject
  running: boolean
  focus: boolean
  onOpen: (id: string) => void
}) {
  const cls = ['sched-table-row', block.late ? 'late' : '', running ? 'running' : '', focus ? 'focus' : ''].filter(Boolean).join(' ')
  return (
    <tr className={cls} onClick={() => onOpen(block.itemId)}>
      <td className="mono">
        {clock(block.startsAt)}-{clock(block.endsAt)}
      </td>
      <td className="mono sched-table-key">{block.externalKey}</td>
      <td className="sched-table-title">{block.title}</td>
      <td className="sched-table-project">
        {project ? (
          <>
            <i className="sched-swatch" style={{ background: project.color }} />
            {project.name}
          </>
        ) : null}
      </td>
      <td className="mono sched-table-span">{span(seconds(block.startsAt, block.endsAt))}</td>
      <td className="sched-table-flags">
        <span className="sched-block-flags">
          {block.late ? <span className="sched-chip late">late</span> : null}
          {block.continued ? <span className="sched-chip">continues</span> : null}
          {running ? <span className="sched-chip live">in time</span> : null}
          {block.occupancy === 'parallel' ? <span className="sched-chip">parallel</span> : null}
        </span>
      </td>
    </tr>
  )
}

function MeetingRow({ busy, onBusy }: { busy: ScheduleBusy; onBusy: (id: string) => void }) {
  return (
    <tr className="sched-table-row meeting" onClick={() => busy.seriesId && onBusy(busy.seriesId)}>
      <td className="mono">
        {clock(busy.startsAt)}-{clock(busy.endsAt)}
      </td>
      <td />
      <td className="sched-table-title">
        <CalendarBlank size={12} weight="light" aria-hidden />
        {busy.title}
      </td>
      <td className="sched-table-project">Meeting</td>
      <td className="mono sched-table-span">{span(seconds(busy.startsAt, busy.endsAt))}</td>
      <td />
    </tr>
  )
}

export function ScheduleTable({ lanes, busy, days, today, runningIds, focusIds, projectOf, onOpen, onBusy }: Props) {
  return (
    <div className="sched-table-wrap">
      <table className="sched-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Key</th>
            <th>Task</th>
            <th className="sched-table-project">Project</th>
            <th className="sched-table-span">Span</th>
            <th>Flags</th>
          </tr>
        </thead>
        {days.map((ymd) => {
          const head = dayHead(ymd, today)
          const rows = dayRows(lanes, busy, ymd)
          if (head.weekend && rows.length === 0) return null
          return (
            <tbody key={ymd} className={head.today ? 'today' : undefined}>
              <tr className={head.today ? 'sched-table-day today' : 'sched-table-day'}>
                <th colSpan={COLUMNS}>
                  <span className="sched-table-date">
                    {head.week} {head.num}
                  </span>
                  {head.today ? <em>Today</em> : null}
                  <small>{summary(rows)}</small>
                </th>
              </tr>
              {rows.length === 0 ? (
                <tr className="sched-table-row empty">
                  <td colSpan={COLUMNS}>No slots</td>
                </tr>
              ) : (
                rows.map((row) =>
                  row.kind === 'block' ? (
                    <BlockRow
                      key={`${row.block.itemId}-${row.block.startsAt}`}
                      block={row.block}
                      project={projectOf(row.block.itemId)}
                      running={runningIds.has(row.block.itemId)}
                      focus={focusIds.has(`${row.block.itemId}-${row.block.startsAt}`)}
                      onOpen={onOpen}
                    />
                  ) : (
                    <MeetingRow key={`${row.busy.startsAt}-${row.busy.title}`} busy={row.busy} onBusy={onBusy} />
                  ),
                )
              )}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
