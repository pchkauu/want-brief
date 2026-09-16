import type { Item, Quadrant } from '../../types'

const ORDER: Record<Quadrant, number> = {
  do: 0,
  schedule: 1,
  delegate: 2,
  drop: 3,
}

export function compareScheduleItems(a: Item, b: Item): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  const quadrant = ORDER[a.quadrant] - ORDER[b.quadrant]
  if (quadrant !== 0) return quadrant
  if (!a.devDueAt && b.devDueAt) return 1
  if (a.devDueAt && !b.devDueAt) return -1
  if (a.devDueAt && b.devDueAt) {
    const diff = new Date(a.devDueAt).getTime() - new Date(b.devDueAt).getTime()
    if (diff !== 0) return diff
  }
  const stress = (b.stress ?? -1) - (a.stress ?? -1)
  if (stress !== 0) return stress
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}
