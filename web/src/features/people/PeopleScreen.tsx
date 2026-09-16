import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Window } from '../../shared/Window'
import { PeopleBoard } from './PeopleBoard'
import { PeopleGrid } from './PeopleGrid'
import { PeopleTable } from './PeopleTable'
import { PersonCard } from './PersonCard'
import { PersonDossier } from './PersonDossier'
import './people.css'

const VIEWS = ['split', 'list', 'kanban', 'grid'] as const
type PeopleView = (typeof VIEWS)[number]

function parseView(raw: string | null): PeopleView {
  if (raw === 'list' || raw === 'kanban' || raw === 'grid') return raw
  return 'split'
}

function peopleHref(opts: { id?: string; view: PeopleView; creating?: boolean }): string {
  const params = new URLSearchParams()
  if (opts.view !== 'split' || opts.creating) params.set('view', opts.view)
  if (opts.creating) params.set('new', '1')
  const query = params.toString()
  const base = opts.id ? `/people/${opts.id}` : '/people'
  return query ? `${base}?${query}` : base
}

export function PeopleScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const view = parseView(params.get('view'))
  const creating = !id && params.get('new') === '1'
  const open = view === 'split' && (Boolean(id) || creating)
  const navigate = useNavigate()
  const people = useQuery({ queryKey: ['people'], queryFn: api.people })
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (people.data ?? []).filter((person) => {
      if (!needle) return true
      return `${person.name} ${person.profession}`.toLowerCase().includes(needle)
    })
  }, [people.data, query])

  function goView(next: PeopleView) {
    navigate(peopleHref({ id, view: next, creating: creating && next === 'split' }))
  }

  function pick(next: string) {
    navigate(peopleHref({ id: next, view: 'split' }))
  }

  const empty = !people.isLoading && !people.isError && list.length === 0

  return (
    <Window
      className="people-window"
      kicker="Circle"
      title="People"
      actions={
        <>
          <div className="people-tabs" role="tablist" aria-label="View">
            {VIEWS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                className={view === value ? 'on' : ''}
                onClick={() => goView(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tasks-plus"
            aria-label="Add person"
            onClick={() => navigate(peopleHref({ view: 'split', creating: true }))}
          >
            +
          </button>
        </>
      }
    >
      {view === 'split' ? (
        <div className={open ? 'people-split open' : 'people-split'}>
          <div className="people-list">
            <input
              className="people-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search"
              autoComplete="off"
            />
            {people.isLoading ? <p className="muted">Loading…</p> : null}
            {people.isError ? <p className="error">{people.error.message}</p> : null}
            {empty ? <p className="people-empty">{query.trim() ? 'No matches.' : 'No people yet.'}</p> : null}
            {list.map((person) => (
              <PersonCard key={person.id} person={person} selected={person.id === id} onPick={pick} />
            ))}
          </div>
          <div className="people-detail">
            {open ? (
              <PersonDossier
                personId={id}
                onCreated={(next) => navigate(peopleHref({ id: next, view: 'split' }))}
                onDeleted={() => navigate(peopleHref({ view: 'split' }))}
                onClose={() => navigate(peopleHref({ view: 'split' }))}
              />
            ) : (
              <p className="people-empty people-detail-empty">Select a person</p>
            )}
          </div>
        </div>
      ) : (
        <div className="people-browse">
          <input
            className="people-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            autoComplete="off"
          />
          {people.isLoading ? <p className="muted">Loading…</p> : null}
          {people.isError ? <p className="error">{people.error.message}</p> : null}
          {empty ? <p className="people-empty">{query.trim() ? 'No matches.' : 'No people yet.'}</p> : null}
          {!empty && view === 'list' ? <PeopleTable people={list} onPick={pick} /> : null}
          {!empty && view === 'kanban' ? <PeopleBoard people={list} onPick={pick} /> : null}
          {!empty && view === 'grid' ? <PeopleGrid people={list} onPick={pick} /> : null}
        </div>
      )}
    </Window>
  )
}
