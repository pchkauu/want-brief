import type { Person } from '../../types'

type Props = {
  person: Person
  selected: boolean
  onPick: (id: string) => void
}

export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function PersonCard({ person, selected, onPick }: Props) {
  return (
    <button
      type="button"
      className={selected ? 'people-row on' : 'people-row'}
      onClick={() => onPick(person.id)}
    >
      <span className="people-avatar" aria-hidden>
        {personInitials(person.name)}
      </span>
      <span className="people-row-copy">
        <strong>{person.name}</strong>
        <span>{person.profession || 'No profession'}</span>
      </span>
      <span className="people-row-age">{person.age ?? ''}</span>
    </button>
  )
}
