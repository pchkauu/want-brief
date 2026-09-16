import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import { DateField } from '../../shared/DateField'
import { UrlField, OpenUrl } from '../../shared/UrlField'
import { createdLabel, dueHeat, itemCost, liveTracked, span } from '../../shared/format'
import { moscowRange } from '../../shared/moscow'
import {
  KINDS,
  kindLabel,
  statusesForKind,
  statusLabel,
  type ItemKind,
  type ItemStatus,
  type ProjectLink,
} from '../../types'
import { idsToRels, relIds } from '../people/RelationField'
import { PeoplePicker } from '../people/PeoplePicker'
import { useTaskLogPrompt } from './TaskLogPrompt'
import { TaskSheet } from './TaskSheet'
import { TaskTimer } from './TaskTimer'

const LINK_SLOTS = ['GitLab', 'Jira', 'Confluence'] as const

type SlotLabel = (typeof LINK_SLOTS)[number]

function isSlot(label: string): label is SlotLabel {
  return (LINK_SLOTS as readonly string[]).includes(label)
}

function slotUrl(links: ProjectLink[], label: SlotLabel): string {
  return links.find((link) => link.label === label)?.url ?? ''
}

function withSlot(links: ProjectLink[], label: SlotLabel, url: string): ProjectLink[] {
  const rest = links.filter((link) => link.label !== label)
  const next = url.trim()
  if (!next) return rest
  return [...rest, { label, url: next }]
}

function linkCaption(link: ProjectLink): string {
  if (link.label) return link.label
  try {
    return new URL(link.url).hostname
  } catch {
    return link.url
  }
}

function noteStamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function secondsFor(rows: { itemId: string; allocatedSeconds: number }[] | undefined, id: string): number {
  return rows?.find((row) => row.itemId === id)?.allocatedSeconds ?? 0
}

function projectSeconds(rows: { projectId: string | null; allocatedSeconds: number }[] | undefined, id: string | null): number {
  if (!id) return 0
  return rows?.find((row) => row.projectId === id)?.allocatedSeconds ?? 0
}

function isoFromInput(raw: string): string {
  return new Date(raw).toISOString()
}

type Props = {
  id: string
  onGone: () => void
}

export function TaskDossier({ id, onGone }: Props) {
  const promptLog = useTaskLogPrompt()
  const queryClient = useQueryClient()
  const item = useQuery({ queryKey: ['items', id], queryFn: () => api.item(id), enabled: Boolean(id) })
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const notes = useQuery({
    queryKey: ['item-notes', id],
    queryFn: () => api.itemNotes(id),
    enabled: Boolean(id),
  })
  const monthLoad = useQuery({
    queryKey: ['load', 'month'],
    queryFn: () => {
      const bounds = moscowRange('month')
      return api.load(bounds.from, bounds.to)
    },
  })
  const intervals = useQuery({ queryKey: ['intervals'], queryFn: api.intervals, refetchInterval: 1000 })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [devDueAt, setDevDueAt] = useState('')
  const [reviewDueAt, setReviewDueAt] = useState('')
  const [testDueAt, setTestDueAt] = useState('')
  const [planHours, setPlanHours] = useState('0')
  const [planMinutes, setPlanMinutes] = useState('0')
  const [externalKey, setExternalKey] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [slots, setSlots] = useState<Record<SlotLabel, string>>({ GitLab: '', Jira: '', Confluence: '' })
  const [linkOpen, setLinkOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [logDate, setLogDate] = useState(todayDate)
  const [logHours, setLogHours] = useState('0')
  const [logMinutes, setLogMinutes] = useState('0')
  const [formError, setFormError] = useState('')

  const row = item.data
  useEffect(() => {
    if (item.isError) onGone()
  }, [item.isError, onGone])
  useEffect(() => {
    if (!row) return
    setTitle(row.title)
    setDescription(row.description)
    setDueAt(toLocalInput(row.dueAt))
    setDevDueAt(toLocalInput(row.devDueAt))
    setReviewDueAt(toLocalInput(row.reviewDueAt))
    setTestDueAt(toLocalInput(row.testDueAt))
    setPlanHours(String(Math.floor(row.plannedSeconds / 3600)))
    setPlanMinutes(String(Math.floor((row.plannedSeconds % 3600) / 60)))
    setExternalKey(row.externalKey)
    setSlots({
      GitLab: slotUrl(row.links ?? [], 'GitLab'),
      Jira: slotUrl(row.links ?? [], 'Jira'),
      Confluence: slotUrl(row.links ?? [], 'Confluence'),
    })
  }, [
    row?.id,
    row?.updatedAt,
    row?.title,
    row?.description,
    row?.dueAt,
    row?.devDueAt,
    row?.reviewDueAt,
    row?.testDueAt,
    row?.plannedSeconds,
    row?.externalKey,
    row?.links,
  ])

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patchItem(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['load'] })
      void queryClient.invalidateQueries({ queryKey: ['people'] })
      void queryClient.invalidateQueries({ queryKey: ['person'] })
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Could not save.'),
  })
  const addNote = useMutation({
    mutationFn: () => api.createItemNote(id, noteBody),
    onSuccess: () => {
      setNoteBody('')
      setFormError('')
      setNoteOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['item-notes', id] })
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Could not add note.'),
  })
  const addTime = useMutation({
    mutationFn: ({ startedAt, endedAt }: { startedAt: string; endedAt: string }) =>
      api.logInterval(id, startedAt, endedAt),
    onSuccess: () => {
      setLogHours('0')
      setLogMinutes('0')
      setFormError('')
      void queryClient.invalidateQueries({ queryKey: ['intervals'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['load'] })
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Could not add time.'),
  })

  function saveTitle(raw: string) {
    const next = raw.trim()
    if (!next || next === row?.title) return
    patch.mutate({ title: next })
  }

  function saveDescription(raw: string) {
    if (raw.trim() === (row?.description ?? '')) return
    patch.mutate({ description: raw })
  }

  function saveDueField(raw: string, current: string | null | undefined, key: string) {
    if (!raw) {
      if (current) patch.mutate({ [key]: '' })
      return
    }
    const iso = isoFromInput(raw)
    if (iso === current) return
    patch.mutate({ [key]: iso })
  }

  function savePlan(hoursRaw: string, minutesRaw: string) {
    const h = Number(hoursRaw)
    const m = Number(minutesRaw)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59 || !row) return
    const seconds = Math.round(h) * 3600 + Math.round(m) * 60
    if (seconds === row.plannedSeconds) return
    patch.mutate({ plannedSeconds: seconds })
  }

  function saveKey(raw: string) {
    if (!row || row.sourceKind !== 'manual') return
    const next = raw.trim()
    if (next === row.externalKey) return
    patch.mutate({ externalKey: next })
  }

  function saveKind(next: ItemKind) {
    if (!row || next === row.kind) return
    const body: Record<string, unknown> = { kind: next }
    if (!statusesForKind(next).includes(row.status)) body.status = 'backlog'
    patch.mutate(body)
  }

  function saveSlot(label: SlotLabel, url: string) {
    if (!row) return
    if (slotUrl(row.links ?? [], label) === url.trim()) return
    patch.mutate({ links: withSlot(row.links ?? [], label, url) })
  }

  function onAddNote(event: FormEvent) {
    event.preventDefault()
    if (!noteBody.trim()) {
      setFormError('Note is required.')
      return
    }
    addNote.mutate()
  }

  function onAddLink(event: FormEvent) {
    event.preventDefault()
    const url = linkUrl.trim()
    if (!url) {
      setFormError('URL is required.')
      return
    }
    setFormError('')
    patch.mutate(
      { links: [...(row?.links ?? []), { label: linkLabel.trim(), url }] },
      {
        onSuccess: () => {
          setLinkLabel('')
          setLinkUrl('')
          setLinkOpen(false)
        },
      },
    )
  }

  function onAddTime(event: FormEvent) {
    event.preventDefault()
    const h = Number(logHours)
    const m = Number(logMinutes)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) {
      setFormError('Time is invalid.')
      return
    }
    const seconds = Math.round(h) * 3600 + Math.round(m) * 60
    if (seconds <= 0) {
      setFormError('Time is required.')
      return
    }
    const started = new Date(`${logDate}T00:00:00`)
    if (Number.isNaN(started.getTime())) {
      setFormError('Date is invalid.')
      return
    }
    const ended = new Date(started.getTime() + seconds * 1000)
    addTime.mutate({ startedAt: started.toISOString(), endedAt: ended.toISOString() })
  }

  if (!row) {
    return <p className="muted">Loading…</p>
  }

  const manual = row.sourceKind === 'manual'
  const heat = dueHeat(row.dueAt, row.status)
  const running = (intervals.data ?? []).find((entry) => entry.itemId === row.id)
  const trackedLive = liveTracked(row.trackedSeconds, running?.startedAt)
  const project = (projects.data ?? []).find((entry) => entry.id === row.projectId)
  const monthItem = secondsFor(monthLoad.data?.byItem, row.id)
  const monthProject = projectSeconds(monthLoad.data?.byProject, row.projectId)
  const links = row.links ?? []
  const log = notes.data ?? []
  const statuses = statusesForKind(row.kind)
  const usd = project?.monthlyIncomeUsd ?? 0
  const rub = project?.monthlyIncomeRub ?? 0
  const ticket = row.kind === 'task'

  return (
    <div className="tasks-dossier">
      {formError && !linkOpen && !noteOpen ? <p className="error">{formError}</p> : null}
      {manual ? (
        <label className="tasks-title">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => saveTitle(e.currentTarget.value)}
          />
        </label>
      ) : (
        <h3>
          {row.externalKey ? `[${row.externalKey}] ` : ''}
          {row.title}
        </h3>
      )}
      <p className="muted">{row.sourceName}</p>
      <label>
        Status
        <select
          value={row.status}
          onChange={(e) => {
            const status = e.target.value as ItemStatus
            if (status === row.status) return
            patch.mutate({ status }, { onSuccess: () => promptLog(id) })
          }}
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <section>
        <div className="tasks-head">
          <h3>Links</h3>
          <button type="button" className="tasks-plus" aria-label="Add link" onClick={() => setLinkOpen(true)}>
            +
          </button>
        </div>
        <div className="tasks-form tasks-slots">
          {LINK_SLOTS.map((label) => (
            <UrlField
              key={label}
              label={label}
              value={slots[label]}
              onChange={(next) => setSlots((current) => ({ ...current, [label]: next }))}
              onBlur={(next) => saveSlot(label, next)}
            />
          ))}
        </div>
        {links.filter((link) => !isSlot(link.label)).length > 0 ? (
          <table className="tasks-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>URL</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {links.map((link, index) =>
                isSlot(link.label) ? null : (
                  <tr key={`${link.url}-${index}`}>
                    <td>{linkCaption(link)}</td>
                    <td>
                      <span className="url-field-row">
                        <a href={link.url} target="_blank" rel="noreferrer">
                          {link.url}
                        </a>
                        <OpenUrl href={link.url} />
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => patch.mutate({ links: links.filter((_, i) => i !== index) })}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        ) : null}
      </section>
      <section>
        <div className="tasks-head">
          <h3>Log</h3>
          <button type="button" className="tasks-plus" aria-label="Add note" onClick={() => setNoteOpen(true)}>
            +
          </button>
        </div>
        {log.length === 0 ? <p className="muted">No notes yet.</p> : null}
        {log.map((note) => (
          <article key={note.id} className="tasks-note">
            <p className="tasks-kicker">{noteStamp(note.createdAt)}</p>
            <p>{note.body}</p>
          </article>
        ))}
      </section>
      <TaskTimer itemId={row.id} running={running} />
      <div className="tasks-form">
        <label>
          Description
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => saveDescription(e.currentTarget.value)}
          />
        </label>
        <p className="muted">Created · {createdLabel(row.createdAt)}</p>
        {ticket ? (
          <label>
            Dev due
            <DateField
              mode="datetime"
              value={devDueAt}
              onChange={setDevDueAt}
              onCommit={(raw) => saveDueField(raw, row.devDueAt, 'devDueAt')}
            />
          </label>
        ) : null}
        <label
          className={heat >= 1 ? 'tasks-due overdue' : 'tasks-due'}
          style={{ '--due-heat': heat } as CSSProperties}
        >
          {ticket ? 'Task due' : 'Due'}
          <DateField
            mode="datetime"
            value={dueAt}
            onChange={setDueAt}
            onCommit={(raw) => saveDueField(raw, row.dueAt, 'dueAt')}
          />
        </label>
        {ticket ? (
          <>
            <label>
              Review due
              <DateField
                mode="datetime"
                value={reviewDueAt}
                onChange={setReviewDueAt}
                onCommit={(raw) => saveDueField(raw, row.reviewDueAt, 'reviewDueAt')}
              />
            </label>
            <label>
              Tests due
              <DateField
                mode="datetime"
                value={testDueAt}
                onChange={setTestDueAt}
                onCommit={(raw) => saveDueField(raw, row.testDueAt, 'testDueAt')}
              />
            </label>
          </>
        ) : null}
        <div className="tasks-chips">
          <button
            type="button"
            className={row.urgent ? 'chip on' : 'chip'}
            onClick={() => patch.mutate({ urgent: !row.urgent })}
          >
            U
          </button>
          <button
            type="button"
            className={row.important ? 'chip on' : 'chip'}
            onClick={() => patch.mutate({ important: !row.important })}
          >
            I
          </button>
          <button
            type="button"
            className={row.pinned ? 'chip on' : 'chip'}
            onClick={() => patch.mutate({ pinned: !row.pinned })}
          >
            Pin
          </button>
        </div>
        <label>
          Project
          <select value={row.projectId ?? ''} onChange={(e) => patch.mutate({ projectId: e.target.value })}>
            <option value="">No project</option>
            {(projects.data ?? [])
              .filter((entry) => !entry.archivedAt || entry.id === row.projectId)
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.archivedAt ? `${entry.name} (archived)` : entry.name}
                </option>
              ))}
          </select>
        </label>
        <PeoplePicker
          value={idsToRels(row.personIds ?? [])}
          onChange={(people) => patch.mutate({ personIds: relIds(people) })}
        />
        <label>
          Type
          <select value={row.kind} onChange={(e) => saveKind(e.target.value as ItemKind)}>
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {kindLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">Source · {row.sourceName}</p>
        {manual ? (
          <label>
            External ID
            <input
              value={externalKey}
              onChange={(e) => setExternalKey(e.target.value)}
              onBlur={(e) => saveKey(e.currentTarget.value)}
              autoComplete="off"
            />
          </label>
        ) : null}
        <div className="tasks-plan">
          <label>
            Hours
            <input
              type="number"
              min={0}
              step={1}
              value={planHours}
              onChange={(e) => setPlanHours(e.target.value)}
              onBlur={(e) => savePlan(e.currentTarget.value, planMinutes)}
            />
          </label>
          <label>
            Minutes
            <input
              type="number"
              min={0}
              max={59}
              step={1}
              value={planMinutes}
              onChange={(e) => setPlanMinutes(e.target.value)}
              onBlur={(e) => savePlan(planHours, e.currentTarget.value)}
            />
          </label>
        </div>
      </div>
      <section>
        <p className="tasks-kicker">Load</p>
        <p className="tasks-stat">
          <strong className="mono">{span(trackedLive)}</strong>
          <span>tracked lifetime</span>
        </p>
        <p className="tasks-stat">
          <strong className="mono">{span(monthItem)}</strong>
          <span>this month</span>
        </p>
        <p className="tasks-stat">
          <strong className="mono">{itemCost(usd, monthItem, monthProject, 'en-US')}</strong>
          <span>USD fact</span>
        </p>
        <p className="tasks-stat">
          <strong className="mono">{itemCost(rub, monthItem, monthProject, 'ru-RU')}</strong>
          <span>RUB fact</span>
        </p>
        <p className="tasks-stat">
          <strong className="mono">{itemCost(usd, row.plannedSeconds, monthProject, 'en-US')}</strong>
          <span>USD plan</span>
        </p>
        <p className="tasks-stat">
          <strong className="mono">{itemCost(rub, row.plannedSeconds, monthProject, 'ru-RU')}</strong>
          <span>RUB plan</span>
        </p>
        <form className="tasks-form" onSubmit={onAddTime}>
          <p className="tasks-kicker">Add time</p>
          <label>
            Date
            <DateField mode="date" value={logDate} onChange={setLogDate} />
          </label>
          <div className="tasks-plan">
            <label>
              Hours
              <input
                type="number"
                min={0}
                step={1}
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
              />
            </label>
            <label>
              Minutes
              <input
                type="number"
                min={0}
                max={59}
                step={1}
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
              />
            </label>
          </div>
          <button type="submit" disabled={addTime.isPending}>
            Add time
          </button>
        </form>
      </section>
      <button
        type="button"
        className="ghost"
        onClick={() => patch.mutate({ archived: !row.archivedAt })}
      >
        {row.archivedAt ? 'Restore' : 'Archive'}
      </button>
      <TaskSheet
        open={linkOpen}
        kicker="Link"
        title="Add link"
        onClose={() => {
          setLinkOpen(false)
          setFormError('')
        }}
      >
        <form className="tasks-form" onSubmit={onAddLink}>
          <label>
            Label
            <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
          </label>
          <label>
            URL
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
          </label>
          {formError && linkOpen ? <p className="error">{formError}</p> : null}
          <button type="submit">Add</button>
        </form>
      </TaskSheet>
      <TaskSheet
        open={noteOpen}
        kicker="Log"
        title="Add note"
        onClose={() => {
          setNoteOpen(false)
          setFormError('')
        }}
      >
        <form className="tasks-form" onSubmit={onAddNote}>
          <label>
            Note
            <textarea rows={6} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
          </label>
          {formError && noteOpen ? <p className="error">{formError}</p> : null}
          <button type="submit">Add</button>
        </form>
      </TaskSheet>
    </div>
  )
}
