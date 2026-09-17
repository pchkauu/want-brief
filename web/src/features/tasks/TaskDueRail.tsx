import { useState, type CSSProperties } from 'react'
import { DateField } from '../../shared/DateField'
import { dueHeat, dueRemain } from '../../shared/format'
import type { Item } from '../../types'

const slots = [
  { key: 'dueAt', label: 'Task' },
  { key: 'devDueAt', label: 'Dev' },
  { key: 'reviewDueAt', label: 'Review' },
  { key: 'testDueAt', label: 'Test' },
] as const

type DueKey = (typeof slots)[number]['key']

type Props = {
  item: Item
  values?: Record<DueKey, string>
  onChange?: (key: DueKey, value: string) => void
  onCommit?: (key: DueKey, value: string) => void
  compact?: boolean
}

function isoOf(item: Item, key: DueKey): string | null {
  return item[key]
}

export function TaskDueRail({ item, values, onChange, onCommit, compact }: Props) {
  const [open, setOpen] = useState<DueKey | null>(null)
  const rows = item.kind === 'task' ? slots : slots.filter((slot) => slot.key === 'dueAt')
  return (
    <div className={compact ? 'tasks-due-rail compact' : 'tasks-due-rail'}>
      {rows.map((slot) => {
        const iso = isoOf(item, slot.key)
        const heat = dueHeat(iso, item.status)
        const remain = dueRemain(iso)
        const overdue = heat >= 1
        const editing = !compact && open === slot.key
        return (
          <article
            key={slot.key}
            className={overdue ? 'tasks-due-card overdue' : 'tasks-due-card'}
            style={{ '--due-heat': heat } as CSSProperties}
          >
            <strong>{slot.label}</strong>
            {compact ? (
              <p className="tasks-due-remain">{remain || '—'}</p>
            ) : editing ? (
              <DateField
                mode="datetime"
                value={values?.[slot.key] ?? ''}
                onChange={(next) => onChange?.(slot.key, next)}
                onCommit={(raw) => {
                  onCommit?.(slot.key, raw)
                  if (!raw) setOpen(null)
                }}
              />
            ) : (
              <button type="button" className="tasks-due-open ghost" onClick={() => setOpen(slot.key)}>
                {remain || 'Set date'}
              </button>
            )}
            {!compact && (iso || values?.[slot.key]) ? (
              <button
                type="button"
                className="ghost tasks-due-clear"
                onClick={() => {
                  onChange?.(slot.key, '')
                  onCommit?.(slot.key, '')
                  setOpen(null)
                }}
              >
                Clear
              </button>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
