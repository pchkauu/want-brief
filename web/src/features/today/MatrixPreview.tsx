import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import type { Item, Quadrant } from '../../types'
import { priorityItems } from '../matrix/rank'

const cells: { id: Quadrant; title: string }[] = [
  { id: 'do', title: 'Do' },
  { id: 'schedule', title: 'Schedule' },
  { id: 'delegate', title: 'Delegate' },
  { id: 'drop', title: 'Drop' },
]

function topThree(items: Item[], quadrant: Quadrant): Item[] {
  return items
    .filter((item) => item.quadrant === quadrant)
    .sort((a, b) => {
      const stress = (b.stress ?? -1) - (a.stress ?? -1)
      if (stress !== 0) return stress
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    .slice(0, 3)
}

export function MatrixPreview() {
  const items = useQuery({ queryKey: ['items'], queryFn: () => api.items({ openOnly: true }) })
  const rows = priorityItems(items.data ?? [])

  return (
    <section className="panel">
      <h3>Priorities</h3>
      <div className="matrix matrix-preview">
        {cells.map((cell) => {
          const listed = topThree(rows, cell.id)
          const extra = rows.filter((item) => item.quadrant === cell.id).length - listed.length
          return (
            <Link key={cell.id} to="/matrix" className="matrix-cell">
              <div className="today-cell-core">
                <header>
                  <h3>{cell.title}</h3>
                  {extra > 0 ? <small>+{extra}</small> : null}
                </header>
                {listed.length === 0 ? <p className="muted">Empty</p> : null}
                <ul className="list dense">
                  {listed.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
