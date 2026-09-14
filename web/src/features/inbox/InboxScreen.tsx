import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../../api'
import { Window } from '../../shared/Window'
import { KINDS, type ItemKind } from '../../types'

export function InboxScreen() {
  const queryClient = useQueryClient()
  const [sourceId, setSourceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [kind, setKind] = useState<ItemKind | ''>('')
  const [title, setTitle] = useState('')
  const [newKind, setNewKind] = useState<ItemKind>('task')
  const sources = useQuery({ queryKey: ['sources'], queryFn: api.sources })
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const items = useQuery({
    queryKey: ['items', sourceId, projectId, kind],
    queryFn: () =>
      api.items({
        sourceId: sourceId || undefined,
        projectId: projectId || undefined,
        kind: kind || undefined,
      }),
  })
  const create = useMutation({
    mutationFn: () =>
      api.createItem({
        title,
        kind: newKind,
        projectId: projectId || undefined,
      }),
    onSuccess: () => {
      setTitle('')
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patchItem(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })

  const sorted = useMemo(() => items.data ?? [], [items.data])

  function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    create.mutate()
  }

  return (
    <Window title="brief.md">
      <form className="toolbar" onSubmit={onCreate}>
        <input
          placeholder="Capture a brief"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={newKind} onChange={(e) => setNewKind(e.target.value as ItemKind)}>
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => {
          if (!title.trim()) return
          create.mutate()
        }}>
          Add
        </button>
      </form>
      <div className="toolbar">
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">All sources</option>
          {(sources.data ?? []).map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind | '')}>
          <option value="">All kinds</option>
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <ul className="list dense">
        {sorted.map((item) => (
          <li key={item.id}>
            <i className="dot" style={{ background: item.projectColor || 'var(--accent)' }} />
            <div className="grow">
              <strong>
                {item.externalKey ? `${item.externalKey} ` : ''}
                {item.title}
              </strong>
              <small>
                {item.sourceName} · {item.kind} · {item.projectName || 'no project'}
              </small>
            </div>
            <button
              type="button"
              className={item.urgent ? 'chip on' : 'chip'}
              onClick={() => patch.mutate({ id: item.id, body: { urgent: !item.urgent } })}
            >
              U
            </button>
            <button
              type="button"
              className={item.important ? 'chip on' : 'chip'}
              onClick={() => patch.mutate({ id: item.id, body: { important: !item.important } })}
            >
              I
            </button>
            <button
              type="button"
              className="chip"
              onClick={() =>
                patch.mutate({
                  id: item.id,
                  body: { status: item.status === 'open' ? 'done' : 'open' },
                })
              }
            >
              {item.status === 'open' ? 'Done' : 'Open'}
            </button>
            {item.externalKey ? null : (
              <button type="button" className="ghost" onClick={() => remove.mutate(item.id)}>
                Del
              </button>
            )}
          </li>
        ))}
      </ul>
    </Window>
  )
}
