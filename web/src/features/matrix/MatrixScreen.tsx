import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import { Window } from '../../shared/Window'
import type { Item, Quadrant } from '../../types'

const cells: { id: Quadrant; title: string; hint: string }[] = [
  { id: 'do', title: 'Do', hint: 'urgent · important' },
  { id: 'schedule', title: 'Schedule', hint: 'not urgent · important' },
  { id: 'delegate', title: 'Delegate', hint: 'urgent · not important' },
  { id: 'drop', title: 'Drop', hint: 'not urgent · not important' },
]

export function MatrixScreen() {
  const queryClient = useQueryClient()
  const items = useQuery({ queryKey: ['items'], queryFn: () => api.items({ status: 'open' }) })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patchItem(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })

  function move(item: Item, quadrant: Quadrant) {
    patch.mutate({
      id: item.id,
      body: {
        urgent: quadrant === 'do' || quadrant === 'delegate',
        important: quadrant === 'do' || quadrant === 'schedule',
      },
    })
  }

  return (
    <Window title="Priorities">
      <div className="matrix">
        {cells.map((cell) => (
          <section
            key={cell.id}
            className="matrix-cell"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData('text/plain')
              const item = (items.data ?? []).find((row) => row.id === id)
              if (item) move(item, cell.id)
            }}
          >
            <header>
              <h3>{cell.title}</h3>
              <small>{cell.hint}</small>
            </header>
            <ul className="list">
              {(items.data ?? [])
                .filter((item) => item.quadrant === cell.id)
                .map((item) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
                  >
                    <strong>{item.title}</strong>
                    <small>{item.sourceName}</small>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </Window>
  )
}
