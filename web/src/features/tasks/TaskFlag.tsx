type Props = {
  glyph: string
  label: string
  on?: boolean
  onClick: () => void
}

export function TaskFlag({ glyph, label, on, onClick }: Props) {
  return (
    <button
      type="button"
      className={on ? 'tasks-flag on' : 'tasks-flag'}
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span aria-hidden>{glyph}</span>
    </button>
  )
}
