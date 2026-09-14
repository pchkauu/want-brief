import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { Window } from '../../shared/Window'

export function SettingsScreen() {
  const queryClient = useQueryClient()
  const sources = useQuery({ queryKey: ['sources'], queryFn: api.sources })
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const [kind, setKind] = useState<'jira' | 'todoist'>('jira')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [query, setQuery] = useState('')
  const [projectName, setProjectName] = useState('')
  const [hours, setHours] = useState('10')
  const [error, setError] = useState('')

  const createSource = useMutation({
    mutationFn: () =>
      api.createSource({
        kind,
        name,
        baseUrl,
        token,
        query,
      }),
    onSuccess: () => {
      setName('')
      setToken('')
      void queryClient.invalidateQueries({ queryKey: ['sources'] })
    },
    onError: (err: Error) => setError(err.message),
  })
  const sync = useMutation({
    mutationFn: api.syncSource,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sources'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
    onError: (err: Error) => setError(err.message),
  })
  const patchToken = useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) => api.patchSource(id, { token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  })
  const removeSource = useMutation({
    mutationFn: api.deleteSource,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  })
  const createProject = useMutation({
    mutationFn: () =>
      api.createProject({
        name: projectName,
        color: '#4C4CFF',
        targetHoursWeek: Number(hours) || 0,
      }),
    onSuccess: () => {
      setProjectName('')
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const jiraCount = (sources.data ?? []).filter((source) => source.kind === 'jira').length

  function onAddSource(event: FormEvent) {
    event.preventDefault()
    setError('')
    createSource.mutate()
  }

  return (
    <Window title="settings">
      {error ? <p className="error">{error}</p> : null}
      <h3>Sources</h3>
      <ul className="list dense">
        {(sources.data ?? []).map((source) => (
          <li key={source.id}>
            <div className="grow">
              <strong>{source.name}</strong>
              <small>
                {source.kind} · {source.hasToken ? 'token set' : 'no token'} ·{' '}
                {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : 'never synced'}
              </small>
            </div>
            {source.kind === 'local' ? null : (
              <>
                <button type="button" onClick={() => sync.mutate(source.id)} disabled={sync.isPending}>
                  Sync
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const next = window.prompt('PAT / API token')
                    if (next) patchToken.mutate({ id: source.id, token: next })
                  }}
                >
                  Token
                </button>
                <button type="button" className="ghost" onClick={() => removeSource.mutate(source.id)}>
                  Del
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="stack" onSubmit={onAddSource}>
        <div className="row">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'jira' | 'todoist')}
          >
            <option value="jira" disabled={jiraCount >= 3}>
              Jira
            </option>
            <option value="todoist">Todoist</option>
          </select>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <input
          placeholder={kind === 'jira' ? 'https://your-domain.atlassian.net' : 'https://api.todoist.com'}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <input
          placeholder="PAT or email:apiToken"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          placeholder={kind === 'jira' ? 'JQL filter' : 'Todoist filter (optional)'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          disabled={kind === 'jira' && jiraCount >= 3}
          onClick={() => {
            setError('')
            createSource.mutate()
          }}
        >
          Add source
        </button>
      </form>
      <h3>Projects</h3>
      <ul className="list">
        {(projects.data ?? []).map((project) => (
          <li key={project.id}>
            <i className="dot" style={{ background: project.color }} />
            <div className="grow">
              <strong>{project.name}</strong>
              <small>{project.targetHoursWeek}h / week planned</small>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault()
          if (projectName.trim()) createProject.mutate()
        }}
      >
        <input
          placeholder="Project name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />
        <input
          type="number"
          min={0}
          step={0.5}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            if (projectName.trim()) createProject.mutate()
          }}
        >
          Add
        </button>
      </form>
    </Window>
  )
}
