import type { Person } from '../../types'
import { personInitials } from './PersonCard'

type Props = {
  people: Person[]
  onPick: (id: string) => void
}

export function PeopleGrid({ people, onPick }: Props) {
  return (
    <div className="people-grid">
      {people.map((person) => (
        <button key={person.id} type="button" className="people-tile" onClick={() => onPick(person.id)}>
          <span className="people-avatar" aria-hidden>
            {personInitials(person.name)}
          </span>
          <span className="people-row-copy">
            <strong>{person.name}</strong>
            <span>{person.profession || 'No profession'}</span>
            <span>{person.age ?? ''}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
