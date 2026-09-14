import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import { Window } from '../../shared/Window'
import { elapsed } from '../../shared/format'

export function TrackScreen() {
  const queryClient = useQueryClient()
  const items = useQuery({ queryKey: ['items'], queryFn: () => api.items({ status: 'open' }) })
  const intervals = useQuery({ queryKey: ['intervals'], queryFn: api.intervals, refetchInterval: 1000 })
  const start = useMutation({
    mutationFn: api.startInterval,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['intervals'] }),
  })
  const stop = useMutation({
    mutationFn: api.stopInterval,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['intervals'] })
      void queryClient.invalidateQueries({ queryKey: ['load'] })
    },
  })
  const stress = useMutation({
    mutationFn: ({ id, level }: { id: string; level: number }) => api.createStress(level, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })

  const runningByItem = new Map((intervals.data ?? []).map((row) => [row.itemId, row]))

  return (
    <Window title="focus.exe">
      <p className="muted">Parallel timers allowed. Each clock counts full time on its task.</p>
      <ul className="list dense">
        {(items.data ?? []).map((item) => {
          const running = runningByItem.get(item.id)
          return (
            <li key={item.id}>
              <i className="dot" style={{ background: item.kind === 'life' ? '#7C8CFF' : 'var(--accent)' }} />
              <div className="grow">
                <strong>{item.title}</strong>
                <small>
                  {item.kind} · {item.projectName || 'unassigned'}
                </small>
              </div>
              {running ? <span className="mono">{elapsed(running.startedAt)}</span> : null}
              {running ? (
                <button type="button" onClick={() => stop.mutate(running.id)}>
                  Stop
                </button>
              ) : (
                <button type="button" className="ghost" onClick={() => start.mutate(item.id)}>
                  Start
                </button>
              )}
              <select
                value={item.stress ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (value) stress.mutate({ id: item.id, level: value })
                }}
              >
                <option value="">stress</option>
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </li>
          )
        })}
      </ul>
    </Window>
  )
}
