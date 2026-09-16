import type { Person } from '../../types'
import { personInitials } from './PersonCard'

type Props = {
  people: Person[]
  onPick: (id: string) => void
}

function columnsFor(people: Person[]): [string, Person[]][] {
  const map = new Map<string, Person[]>()
  for (const person of people) {
    const key = person.profession.trim() || 'No profession'
    const rows = map.get(key) ?? []
    rows.push(person)
    map.set(key, rows)
  }
  return [...map.entries()]
}

export function PeopleBoard({ people, onPick }: Props) {
  const columns = columnsFor(people)
  return (
    <div className="people-board">
      {columns.map(([label, rows]) => (
        <section key={label} className="people-col">
          <header>
            <h3>{label}</h3>
            <span>{rows.length}</span>
          </header>
          {rows.map((person) => (
            <button key={person.id} type="button" className="people-tile" onClick={() => onPick(person.id)}>
              <span className="people-avatar" aria-hidden>
                {personInitials(person.name)}
              </span>
              <span className="people-row-copy">
                <strong>{person.name}</strong>
                <span>{person.age ?? ''}</span>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}
