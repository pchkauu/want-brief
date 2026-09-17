import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { createdLabel, liveTracked, span } from '../../shared/format'
import { kindLabel, type Item, type TimeInterval } from '../../types'
import { TaskDueRail } from './TaskDueRail'
import { TaskTimer } from './TaskTimer'

const DRAG_TYPE = 'application/x-want-item'

export function encodeTaskDrag(item: Item): string {
  return JSON.stringify({ id: item.id, kind: item.kind })
}

export function decodeTaskDrag(raw: string): { id: string; kind: Item['kind'] } | null {
  try {
    const data = JSON.parse(raw) as { id?: string; kind?: Item['kind'] }
    if (!data.id || !data.kind) return null
    return { id: data.id, kind: data.kind }
  } catch {
    return null
  }
}

export { DRAG_TYPE }

type Props = {
  item: Item
  running?: TimeInterval
  yieldUsd?: string
  yieldRub?: string
}

export function TaskCard({ item, running, yieldUsd, yieldRub }: Props) {
  const queryClient = useQueryClient()
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patchItem(item.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
  const tracked = liveTracked(item.trackedSeconds, running?.startedAt)
  const planned = item.plannedSeconds
  const overflow = planned > 0 && tracked > planned
  const ratio = planned > 0 ? Math.min(1, tracked / planned) : 0
  const showYield = Boolean(yieldUsd || yieldRub)
  const checks = item.checkTotal > 0 ? `${item.checkDone}/${item.checkTotal}` : ''

  return (
    <article
      className={item.archivedAt ? 'tasks-card archived' : 'tasks-card'}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, encodeTaskDrag(item))
        event.dataTransfer.setData('text/plain', encodeTaskDrag(item))
        event.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="tasks-card-core">
        <span className="tasks-kind">{kindLabel(item.kind)}</span>
        <Link to={`/tasks/${item.id}`} draggable={false}>
          {item.externalKey ? <span className="tasks-key mono">[{item.externalKey}]</span> : null}
          {item.externalKey ? ' ' : null}
          {item.title}
        </Link>
        <p className="tasks-card-meta">
          <span className="tasks-project">
            <i className="tasks-swatch" style={{ background: item.projectColor || 'var(--accent)' }} />
            {item.projectName || '—'}
          </span>
          {checks ? <span className="muted">{checks}</span> : null}
          {item.createdAt ? <span className="muted">{createdLabel(item.createdAt)}</span> : null}
        </p>
        <TaskDueRail item={item} compact />
        {planned > 0 ? (
          <div className={overflow ? 'tasks-track overflow' : 'tasks-track'}>
            <span className="tasks-track-rail">
              <span className="tasks-track-bar" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </span>
            <small>
              {span(tracked)} / {span(planned)}
            </small>
          </div>
        ) : (
          <p className="tasks-track-fact muted">{span(tracked)}</p>
        )}
        {showYield ? (
          <p className="tasks-yield mono">
            ${yieldUsd} · ₽{yieldRub}
          </p>
        ) : null}
        <div className="tasks-card-flags">
          <button
            type="button"
            className={item.urgent ? 'chip on' : 'chip'}
            onClick={() => patch.mutate({ urgent: !item.urgent })}
            onPointerDown={(event) => event.stopPropagation()}
          >
            U
          </button>
          <button
            type="button"
            className={item.important ? 'chip on' : 'chip'}
            onClick={() => patch.mutate({ important: !item.important })}
            onPointerDown={(event) => event.stopPropagation()}
          >
            I
          </button>
          <TaskTimer itemId={item.id} running={running} />
        </div>
      </div>
    </article>
  )
}
