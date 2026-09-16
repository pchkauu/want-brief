import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import { DateField } from '../../shared/DateField'
import type { Person } from '../../types'
import { personInitials } from './PersonCard'
import { idsToRels, relIds, RelationField } from './RelationField'

type Props = {
  personId?: string
  onCreated: (id: string) => void
  onDeleted: () => void
  onClose?: () => void
}

function dateOnly(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function draftFrom(row?: Person) {
  return {
    name: row?.name ?? '',
    bornOn: dateOnly(row?.bornOn ?? null),
    ageYears: row?.ageYears != null ? String(row.ageYears) : '',
    profession: row?.profession ?? '',
    monthlySalaryUsd: row ? String(row.monthlySalaryUsd) : '0',
    monthlySalaryRub: row ? String(row.monthlySalaryRub) : '0',
    projects: row?.projects ?? [],
    events: row?.events ?? [],
    items: idsToRels(row?.itemIds ?? []),
  }
}

function noteStamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function PersonDossier({ personId, onCreated, onDeleted, onClose }: Props) {
  const queryClient = useQueryClient()
  const person = useQuery({
    queryKey: ['person', personId],
    queryFn: () => api.person(personId!),
    enabled: Boolean(personId),
  })
  const notes = useQuery({
    queryKey: ['person-notes', personId],
    queryFn: () => api.personNotes(personId!),
    enabled: Boolean(personId),
  })
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const series = useQuery({ queryKey: ['event-series'], queryFn: api.eventSeries })
  const items = useQuery({ queryKey: ['items'], queryFn: () => api.items({ includeArchived: true }) })
  const [form, setForm] = useState(() => draftFrom())
  const [noteBody, setNoteBody] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (personId && person.data) setForm(draftFrom(person.data))
    if (!personId) setForm(draftFrom())
  }, [personId, person.data?.id, person.data?.updatedAt])

  useEffect(() => {
    if (!onClose) return
    const close = onClose
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function body() {
    const bornOn = form.bornOn.trim()
    const years = form.ageYears.trim()
    return {
      name: form.name.trim(),
      bornOn: bornOn || null,
      ageYears: !bornOn && years !== '' ? Number(years) : null,
      profession: form.profession,
      monthlySalaryUsd: Number(form.monthlySalaryUsd) || 0,
      monthlySalaryRub: Number(form.monthlySalaryRub) || 0,
      projects: form.projects,
      events: form.events,
      itemIds: relIds(form.items),
    }
  }

  const save = useMutation({
    mutationFn: () => (personId ? api.patchPerson(personId, body()) : api.createPerson(body())),
    onSuccess: (row) => {
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['people'] })
      void queryClient.invalidateQueries({ queryKey: ['person'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['event'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      if (!personId) onCreated(row.id)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save.'),
  })
  const remove = useMutation({
    mutationFn: () => api.deletePerson(personId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['people'] })
      void queryClient.invalidateQueries({ queryKey: ['person'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['event'] })
      void queryClient.invalidateQueries({ queryKey: ['event-series'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      onDeleted()
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not delete.'),
  })
  const addNote = useMutation({
    mutationFn: () => api.createPersonNote(personId!, noteBody),
    onSuccess: () => {
      setNoteBody('')
      void queryClient.invalidateQueries({ queryKey: ['person-notes', personId] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not add note.'),
  })
  const dropNote = useMutation({
    mutationFn: (noteId: string) => api.deletePersonNote(personId!, noteId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['person-notes', personId] }),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    if (form.projects.some((rel) => !rel.comment.trim()) || form.events.some((rel) => !rel.comment.trim())) {
      setError('Comment is required for each project and event.')
      return
    }
    save.mutate()
  }

  if (personId && person.isLoading) return <p className="muted">Loading…</p>
  if (personId && person.isError) return <p className="error">{person.error.message}</p>

  const log = notes.data ?? []
  const title = person.data?.name || (personId ? 'Person' : 'New person')
  const subtitle = person.data?.profession || (personId ? '' : 'Create a record')

  return (
    <form className="people-form" onSubmit={onSubmit}>
      <header className="people-detail-head">
        {onClose ? (
          <button type="button" className="people-close" onClick={onClose}>
            Close
          </button>
        ) : null}
        <span className="people-avatar" aria-hidden>
          {personInitials(person.data?.name || title)}
        </span>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <label>
        Name
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />
      </label>
      <label>
        Born
        <DateField
          mode="date"
          value={form.bornOn}
          onChange={(next) => setForm({ ...form, bornOn: next, ageYears: '' })}
        />
      </label>
      <label>
        Age
        <input
          type="number"
          min={0}
          max={150}
          value={form.ageYears}
          onChange={(e) => setForm({ ...form, ageYears: e.target.value, bornOn: '' })}
        />
      </label>
      <label>
        Profession
        <input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
      </label>
      <div className="people-pair">
        <label>
          Salary USD
          <input type="number" min={0} step={0.01} value={form.monthlySalaryUsd} onChange={(e) => setForm({ ...form, monthlySalaryUsd: e.target.value })} />
        </label>
        <label>
          Salary RUB
          <input type="number" min={0} step={0.01} value={form.monthlySalaryRub} onChange={(e) => setForm({ ...form, monthlySalaryRub: e.target.value })} />
        </label>
      </div>
      <RelationField
        label="Projects"
        options={(projects.data ?? []).map((row) => ({ id: row.id, name: row.name }))}
        value={form.projects}
        onChange={(projects) => setForm({ ...form, projects })}
        requireComment
      />
      <RelationField
        label="Events"
        options={(series.data ?? []).map((row) => ({ id: row.id, name: row.title }))}
        value={form.events}
        onChange={(events) => setForm({ ...form, events })}
        requireComment
      />
      <RelationField
        label="Tasks"
        options={(items.data ?? []).map((row) => ({ id: row.id, name: row.title }))}
        value={form.items}
        onChange={(next) => setForm({ ...form, items: next })}
      />
      {personId ? (
        <section>
          <p className="people-kicker">Log</p>
          {log.length === 0 ? <p className="people-empty">No notes yet.</p> : null}
          {log.map((note) => (
            <article key={note.id} className="people-note">
              <p className="people-kicker">{noteStamp(note.createdAt)}</p>
              <p>{note.body}</p>
              <button type="button" className="ghost" onClick={() => dropNote.mutate(note.id)}>
                Remove
              </button>
            </article>
          ))}
          <label>
            Note
            <textarea rows={3} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
          </label>
          <button type="button" className="ghost" onClick={() => addNote.mutate()} disabled={!noteBody.trim() || addNote.isPending}>
            Add note
          </button>
        </section>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={save.isPending}>
        {personId ? 'Save' : 'Create'}
      </button>
      {personId ? (
        <button type="button" className="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
          Delete
        </button>
      ) : null}
    </form>
  )
}
