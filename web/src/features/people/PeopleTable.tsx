import type { Person } from '../../types'
import { personInitials } from './PersonCard'

type Props = {
  people: Person[]
  onPick: (id: string) => void
}

export function PeopleTable({ people, onPick }: Props) {
  return (
    <div className="people-table-wrap">
      <table className="people-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Profession</th>
            <th>Age</th>
            <th>Projects</th>
            <th>Events</th>
            <th>Tasks</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} onClick={() => onPick(person.id)}>
              <td>
                <button type="button" className="people-table-name" onClick={() => onPick(person.id)}>
                  <span className="people-avatar" aria-hidden>
                    {personInitials(person.name)}
                  </span>
                  {person.name}
                </button>
              </td>
              <td>{person.profession || 'No profession'}</td>
              <td className="mono">{person.age ?? ''}</td>
              <td className="mono">{person.projects.length}</td>
              <td className="mono">{person.events.length}</td>
              <td className="mono">{person.itemIds.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
