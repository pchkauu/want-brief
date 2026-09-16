import type { Person } from '../../types'
import { bondKindLabel, primaryContact, professionLabel } from './peopleModel'

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
  const primary = primaryContact(person)
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
        <span>
          {professionLabel(person) || 'No profession'}
          {primary ? ` · ${primary.value}` : ''}
        </span>
      </span>
      <span className="people-row-age">
        {person.age ?? ''}
        {person.meBond ? ` · ${bondKindLabel(person.meBond.kind)}` : ''}
      </span>
    </button>
  )
}
