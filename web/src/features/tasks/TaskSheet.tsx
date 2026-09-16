import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  kicker?: string
  onClose: () => void
  children: ReactNode
}

const closers: Array<() => void> = []

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  closers[closers.length - 1]?.()
}

export function TaskSheet({ open, title, kicker = 'New', onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    closers.push(onClose)
    if (closers.length === 1) window.addEventListener('keydown', onEscape)
    return () => {
      const index = closers.lastIndexOf(onClose)
      if (index >= 0) closers.splice(index, 1)
      if (closers.length === 0) window.removeEventListener('keydown', onEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="tasks-sheet-root">
      <button type="button" className="tasks-sheet-back" aria-label="Close" onClick={onClose} />
      <aside className="tasks-sheet" role="dialog" aria-modal="true" aria-labelledby="tasks-sheet-title">
        <div className="tasks-sheet-core">
          <header>
            <p className="tasks-kicker">{kicker}</p>
            <h2 id="tasks-sheet-title">{title}</h2>
          </header>
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
