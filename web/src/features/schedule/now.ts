import { moscowYmd } from '../../shared/moscow'
import type { Quadrant, ScheduleBlock, ScheduleLane } from '../../types'

export type NowPhase = 'now' | 'before' | 'gap' | 'after' | 'off'

export type NowPick = {
  current: ScheduleBlock[]
  upcoming: ScheduleBlock[]
  phase: NowPhase
}

export function clock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function dayHead(ymd: string, today: string) {
  const date = new Date(`${ymd}T12:00:00+03:00`)
  const weekday = date.getDay()
  return {
    today: ymd === today,
    weekend: weekday === 0 || weekday === 6,
    week: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Moscow' }).format(date),
    num: new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/Moscow' }).format(date),
  }
}

export function blocksOn(lanes: ScheduleLane[], ymd: string): ScheduleBlock[] {
  return lanes
    .flatMap((lane) => lane.blocks)
    .filter((row) => moscowYmd(new Date(row.startsAt)) === ymd)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.lane - b.lane)
}

export function todayBlocks(lanes: ScheduleLane[], today: string): ScheduleBlock[] {
  return blocksOn(lanes, today)
}

export function covering(blocks: ScheduleBlock[], now = Date.now()): ScheduleBlock[] {
  return blocks.filter((row) => new Date(row.startsAt).getTime() <= now && now < new Date(row.endsAt).getTime())
}

function firstPerItem(blocks: ScheduleBlock[]): ScheduleBlock[] {
  const seen = new Set<string>()
  return blocks.filter((row) => !seen.has(row.itemId) && seen.add(row.itemId))
}

export function pickNow(blocks: ScheduleBlock[], now = Date.now()): NowPick {
  if (blocks.length === 0) return { current: [], upcoming: [], phase: 'off' }
  const current = firstPerItem(covering(blocks, now))
  const currentIds = new Set(current.map((row) => row.itemId))
  const later = blocks.filter((row) => new Date(row.startsAt).getTime() > now)
  const upcoming = firstPerItem(later).filter((row) => !currentIds.has(row.itemId))
  if (current.length > 0) return { current, upcoming, phase: 'now' }
  if (later.length === blocks.length) return { current, upcoming, phase: 'before' }
  if (later.length > 0) return { current, upcoming, phase: 'gap' }
  return { current, upcoming, phase: 'after' }
}

export function phaseLabel(pick: NowPick): string {
  switch (pick.phase) {
    case 'now':
      return 'Now'
    case 'before':
      return `Up first at ${clock(pick.upcoming[0].startsAt)}`
    case 'gap':
      return `Next at ${clock(pick.upcoming[0].startsAt)}`
    case 'after':
      return 'Done for today'
    default:
      return 'No slots today'
  }
}

export function quadrantLabel(quadrant: Quadrant): string {
  switch (quadrant) {
    case 'do':
      return 'Do first'
    case 'schedule':
      return 'Schedule'
    case 'delegate':
      return 'Delegate'
    default:
      return 'Drop'
  }
}
