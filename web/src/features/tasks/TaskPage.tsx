import { ArrowCounterClockwise, ArrowsClockwise, ChatTeardrop, Clock, Copy, Pause, Trash } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import { OpenUrl, UrlField } from '../../shared/UrlField'
import { createdLabel, itemCost, liveTracked, span } from '../../shared/format'
import { moscowRange } from '../../shared/moscow'
import {
  KINDS,
  kindLabel,
  occupancyLabel,
  statusesForKind,
  statusLabel,
  type ItemKind,
  type Occupancy,
  type ItemStatus,
  type ProjectLink,
} from '../../types'
import { idsToRels, relIds } from '../people/RelationField'
import { PeoplePicker } from '../people/PeoplePicker'
import { TaskChecks } from './TaskChecks'
import { TaskConfirm } from './TaskConfirm'
import { TaskDueRail } from './TaskDueRail'
import { TaskFlag } from './TaskFlag'
import { TaskTimeLog } from './TaskTimeLog'
import { useTaskLogPrompt } from './TaskLogPrompt'
import { TaskSheet } from './TaskSheet'
import { TaskTimer } from './TaskTimer'
import { useTaskUndo } from './TaskUndo'

const LINK_SLOTS = ['GitLab', 'Jira', 'Confluence'] as const

type SlotLabel = (typeof LINK_SLOTS)[number]
type FieldState = 'idle' | 'saving' | 'saved' | 'error'

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

function FieldHint({ state, error }: { state: FieldState; error?: string }) {
  if (state === 'saving') return <span className="tasks-field-hint">Saving</span>
  if (state === 'saved') return <span className="tasks-field-hint ok">Saved</span>
  if (state === 'error') return <span className="error">{error || 'Could not save.'}</span>
  return null
}

type Props = {
  id: string
  onGone: () => void
}

export function TaskDossierSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const item = useQuery({ queryKey: ['items', id], queryFn: () => api.item(id), enabled: Boolean(id) })
  const title = item.isError ? 'Task not found' : item.data?.title || '…'
  return (
    <TaskSheet open wide title={title} kicker="Task" onClose={onClose}>
      <TaskDossier id={id} onGone={onClose} />
    </TaskSheet>
  )
}

export function TaskDossier({ id, onGone }: Props) {
  const promptLog = useTaskLogPrompt()
  const offerUndo = useTaskUndo()
  const queryClient = useQueryClient()
  const item = useQuery({ queryKey: ['items', id], queryFn: () => api.item(id), enabled: Boolean(id) })
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const sources = useQuery({ queryKey: ['sources'], queryFn: api.sources })
  const notes = useQuery({
    queryKey: ['item-notes', id],
    queryFn: () => api.itemNotes(id),
    enabled: Boolean(id) && !item.isError,
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
  const [noteOpen, setNoteOpen] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [slots, setSlots] = useState<Record<SlotLabel, string>>({ GitLab: '', Jira: '', Confluence: '' })
  const [fields, setFields] = useState<Record<string, { state: FieldState; error?: string }>>({})
  const [kindConfirm, setKindConfirm] = useState<ItemKind | null>(null)
  const [modal, setModal] = useState<'stall' | 'delete' | 'time' | null>(null)
  const [copied, setCopied] = useState(false)

  const row = item.data
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

  function mark(field: string, state: FieldState, error?: string) {
    setFields((current) => ({ ...current, [field]: { state, error } }))
  }

  const patch = useMutation({
    mutationFn: ({ body }: { body: Record<string, unknown>; field?: string }) => api.patchItem(id, body),
    onMutate: ({ field }) => {
      if (field) mark(field, 'saving')
    },
    onSuccess: (_data, { field }) => {
      if (field) {
        mark(field, 'saved')
        window.setTimeout(() => mark(field, 'idle'), 1200)
      }
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['load'] })
      void queryClient.invalidateQueries({ queryKey: ['people'] })
      void queryClient.invalidateQueries({ queryKey: ['person'] })
    },
    onError: (err, { field }) => {
      const message = err instanceof Error ? err.message : 'Could not save.'
      if (field) mark(field, 'error', message)
    },
  })
  const addNote = useMutation({
    mutationFn: () => api.createItemNote(id, noteBody),
    onSuccess: () => {
      setNoteBody('')
      setNoteOpen(false)
      mark('note', 'idle')
      void queryClient.invalidateQueries({ queryKey: ['item-notes', id] })
    },
    onError: (err) => mark('note', 'error', err instanceof Error ? err.message : 'Could not add note.'),
  })
  const syncRemote = useMutation({
    mutationFn: () => api.syncItem(id),
    onSuccess: () => {
      mark('sync', 'saved')
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['item-notes', id] })
      void queryClient.invalidateQueries({ queryKey: ['sources'] })
    },
    onError: (err) => mark('sync', 'error', err instanceof Error ? err.message : 'Could not sync.'),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteItem(id),
    onSuccess: () => {
      setModal(null)
      offerUndo('Task deleted.', async () => {
        await api.undeleteItem(id)
        void queryClient.invalidateQueries({ queryKey: ['items'] })
        void queryClient.invalidateQueries({ queryKey: ['schedule'] })
        void queryClient.invalidateQueries({ queryKey: ['load'] })
        void queryClient.invalidateQueries({ queryKey: ['people'] })
      })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['schedule'] })
      void queryClient.invalidateQueries({ queryKey: ['load'] })
      void queryClient.invalidateQueries({ queryKey: ['people'] })
      onGone()
    },
    onError: (err) => mark('delete', 'error', err instanceof Error ? err.message : 'Could not delete.'),
  })

  function saveTitle(raw: string) {
    const next = raw.trim()
    if (!next || next === row?.title) return
    patch.mutate({ body: { title: next }, field: 'title' })
  }

  function saveDescription(raw: string) {
    if (raw.trim() === (row?.description ?? '')) return
    patch.mutate({ body: { description: raw }, field: 'description' })
  }

  function saveDueField(raw: string, current: string | null | undefined, key: string) {
    if (!raw) {
      if (current) patch.mutate({ body: { [key]: '' }, field: key })
      return
    }
    const iso = isoFromInput(raw)
    if (iso === current) return
    patch.mutate({ body: { [key]: iso }, field: key })
  }

  function savePlan(hoursRaw: string, minutesRaw: string) {
    const h = Number(hoursRaw)
    const m = Number(minutesRaw)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59 || !row) return
    const seconds = Math.round(h) * 3600 + Math.round(m) * 60
    if (seconds === row.plannedSeconds) return
    patch.mutate({ body: { plannedSeconds: seconds }, field: 'estimate' })
  }

  function saveKey(raw: string) {
    if (!row || row.sourceKind !== 'manual') return
    const next = raw.trim()
    if (next === row.externalKey) return
    patch.mutate({ body: { externalKey: next }, field: 'key' })
  }

  function applyKind(next: ItemKind) {
    if (!row || next === row.kind) return
    const body: Record<string, unknown> = { kind: next }
    if (!statusesForKind(next).includes(row.status)) body.status = 'backlog'
    patch.mutate({ body, field: 'kind' })
  }

  function saveKind(next: ItemKind) {
    if (!row || next === row.kind) return
    if (!statusesForKind(next).includes(row.status)) {
      setKindConfirm(next)
      return
    }
    applyKind(next)
  }

  function saveSlot(label: SlotLabel, url: string) {
    if (!row) return
    if (slotUrl(row.links ?? [], label) === url.trim()) return
    patch.mutate({ body: { links: withSlot(row.links ?? [], label, url) }, field: `slot-${label}` })
  }

  function onAddNote(event: FormEvent) {
    event.preventDefault()
    if (!noteBody.trim()) {
      mark('note', 'error', 'Note is required.')
      return
    }
    addNote.mutate()
  }

  function onAddLink(event: FormEvent) {
    event.preventDefault()
    const url = linkUrl.trim()
    if (!url) {
      mark('link', 'error', 'URL is required.')
      return
    }
    patch.mutate(
      { body: { links: [...(row?.links ?? []), { label: linkLabel.trim(), url }] }, field: 'link' },
      {
        onSuccess: () => {
          setLinkLabel('')
          setLinkUrl('')
          setLinkOpen(false)
        },
      },
    )
  }

  function applyStall() {
    if (!row) return
    const next = !row.archivedAt
    const previous = Boolean(row.archivedAt)
    patch.mutate(
      { body: { archived: next }, field: 'stall' },
      {
        onSuccess: () => {
          setModal(null)
          offerUndo(next ? 'Task stalled.' : 'Task restored.', async () => {
            await api.patchItem(id, { archived: previous })
            void queryClient.invalidateQueries({ queryKey: ['items'] })
          })
        },
      },
    )
  }

  if (item.isError) {
    return (
      <div className="tasks-missing">
        <p>Task not found</p>
        <button type="button" onClick={onGone}>
          Close
        </button>
      </div>
    )
  }

  if (!row) {
    return <p className="muted">Loading…</p>
  }

  const manual = row.sourceKind === 'manual'
  const remote = row.sourceKind === 'jira' || row.sourceKind === 'todoist'
  const running = (intervals.data ?? []).find((entry) => entry.itemId === row.id)
  const trackedLive = liveTracked(row.trackedSeconds, running?.startedAt)
  const project = (projects.data ?? []).find((entry) => entry.id === row.projectId)
  const source = (sources.data ?? []).find((entry) => entry.id === row.sourceId)
  const monthItem = secondsFor(monthLoad.data?.byItem, row.id)
  const monthProject = projectSeconds(monthLoad.data?.byProject, row.projectId)
  const links = row.links ?? []
  const log = notes.data ?? []
  const statuses = statusesForKind(row.kind)
  const usd = project?.monthlyIncomeUsd ?? 0
  const rub = project?.monthlyIncomeRub ?? 0
  const filledSlots = LINK_SLOTS.filter((label) => slots[label])
  const extraLinks = links.filter((link) => !isSlot(link.label))
  const remoteHref = slotUrl(links, 'Jira') || links.find((link) => /^https?:/.test(link.url))?.url || ''
  const meta = [row.sourceName, row.externalKey, row.externalStatus].filter(Boolean).join(' · ')

  function hint(field: string): ReactNode {
    const entry = fields[field]
    if (!entry) return null
    return <FieldHint state={entry.state} error={entry.error} />
  }

  return (
    <div className="tasks-dossier">
      <section className="tasks-work">
        {manual ? (
          <label className="tasks-title">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => saveTitle(e.currentTarget.value)}
            />
            {hint('title')}
          </label>
        ) : (
          <h3 className="tasks-title-display">{row.title}</h3>
        )}
        <div className="tasks-meta">
          <p className="muted">{meta || row.sourceName}</p>
          {row.externalKey ? (
            <button
              type="button"
              className="ghost tasks-icon-btn"
              aria-label="Copy key"
              onClick={() => {
                void navigator.clipboard.writeText(row.externalKey)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1200)
              }}
            >
              <Copy size={16} weight="light" />
              {copied ? 'Copied' : row.externalKey}
            </button>
          ) : null}
          <OpenUrl href={remoteHref} label="Open source" />
        </div>
        <div className="tasks-head">
          <label>
            Status
            <select
              value={row.status}
              onChange={(e) => {
                const status = e.target.value as ItemStatus
                if (status === row.status) return
                const previous = row.status
                patch.mutate(
                  { body: { status }, field: 'status' },
                  {
                    onSuccess: () => {
                      offerUndo(
                        'Status updated. Log what changed?',
                        async () => {
                          await api.patchItem(id, { status: previous })
                          void queryClient.invalidateQueries({ queryKey: ['items'] })
                        },
                        { label: 'Log', run: () => promptLog(id) },
                      )
                    },
                  },
                )
              }}
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
            {hint('status')}
          </label>
          <div className="tasks-actions">
            {remote ? (
              <button
                type="button"
                className="ghost"
                disabled={syncRemote.isPending}
                title={
                  row.sourceKind === 'todoist'
                    ? `Pull Todoist · ${source?.lastSyncAt ? createdLabel(source.lastSyncAt) : 'never'}`
                    : `Pull Jira · ${source?.lastSyncAt ? createdLabel(source.lastSyncAt) : 'never'}`
                }
                aria-label={row.sourceKind === 'todoist' ? 'Pull Todoist' : 'Pull Jira'}
                onClick={() => syncRemote.mutate()}
              >
                <ArrowsClockwise size={18} weight="light" />
              </button>
            ) : null}
            <button type="button" className="ghost" title="Log" aria-label="Log" onClick={() => promptLog(id)}>
              <ChatTeardrop size={18} weight="light" />
            </button>
            <button
              type="button"
              className="ghost"
              title="Log time"
              aria-label="Log time"
              onClick={() => setModal('time')}
            >
              <Clock size={18} weight="light" />
            </button>
            <button
              type="button"
              className="ghost"
              title={row.archivedAt ? 'Restore' : 'Stall'}
              aria-label={row.archivedAt ? 'Restore' : 'Stall'}
              onClick={() => setModal('stall')}
            >
              {row.archivedAt ? <ArrowCounterClockwise size={18} weight="light" /> : <Pause size={18} weight="light" />}
            </button>
            <button
              type="button"
              className="ghost danger"
              title="Delete"
              aria-label="Delete"
              disabled={remove.isPending}
              onClick={() => setModal('delete')}
            >
              <Trash size={18} weight="light" />
            </button>
            {hint('sync')}
            {hint('delete')}
          </div>
        </div>
        <label>
          Occupancy
          <select
            value={row.occupancy || 'solo'}
            onChange={(e) => patch.mutate({ body: { occupancy: e.target.value as Occupancy }, field: 'occupancy' })}
          >
            <option value="solo">{occupancyLabel('solo')}</option>
            <option value="parallel">{occupancyLabel('parallel')}</option>
          </select>
          <p className="muted">Solo never overlaps. Parallel stacks up to 3.</p>
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => saveDescription(e.currentTarget.value)}
          />
          {hint('description')}
        </label>
        <p className="muted">Created · {createdLabel(row.createdAt)}</p>
        <TaskDueRail
          item={row}
          values={{ dueAt, devDueAt, reviewDueAt, testDueAt }}
          onChange={(key, next) => {
            if (key === 'dueAt') setDueAt(next)
            if (key === 'devDueAt') setDevDueAt(next)
            if (key === 'reviewDueAt') setReviewDueAt(next)
            if (key === 'testDueAt') setTestDueAt(next)
          }}
          onCommit={(key, raw) => saveDueField(raw, row[key], key)}
        />
        <div className="tasks-chips">
          <TaskFlag
            glyph="🏃"
            label="Urgent"
            on={row.urgent}
            onClick={() => patch.mutate({ body: { urgent: !row.urgent }, field: 'urgent' })}
          />
          <TaskFlag
            glyph="🔑"
            label="Important"
            on={row.important}
            onClick={() => patch.mutate({ body: { important: !row.important }, field: 'important' })}
          />
          <TaskFlag
            glyph="📌"
            label="Pin"
            on={row.pinned}
            onClick={() => patch.mutate({ body: { pinned: !row.pinned }, field: 'pinned' })}
          />
        </div>
        <TaskTimer itemId={row.id} running={running} prominent />
        <TaskChecks itemId={row.id} />
      </section>

      <details className="tasks-setup">
        <summary>Setup</summary>
        <section>
          <div className="tasks-head">
            <h3>Links</h3>
            <button type="button" className="tasks-plus" aria-label="Add link" onClick={() => setLinkOpen((on) => !on)}>
              +
            </button>
          </div>
          <div className="tasks-form tasks-slots">
            {filledSlots.map((label) => (
              <UrlField
                key={label}
                label={label}
                value={slots[label]}
                onChange={(next) => setSlots((current) => ({ ...current, [label]: next }))}
                onBlur={(next) => saveSlot(label, next)}
              />
            ))}
          </div>
          {hint('slot-GitLab')}
          {hint('slot-Jira')}
          {hint('slot-Confluence')}
          {linkOpen ? (
            <form className="tasks-form" onSubmit={onAddLink}>
              <label>
                Label
                <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="GitLab, Jira…" />
              </label>
              <label>
                URL
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
              </label>
              {hint('link')}
              <button type="submit">Add</button>
            </form>
          ) : null}
          {extraLinks.length > 0 ? (
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>URL</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {extraLinks.map((link) => (
                  <tr key={`${link.label}-${link.url}`}>
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
                        onClick={() =>
                          patch.mutate({
                            body: { links: links.filter((entry) => entry !== link) },
                            field: 'link',
                          })
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section>
          <div className="tasks-head">
            <h3>Log</h3>
            <button type="button" className="tasks-plus" aria-label="Add note" onClick={() => setNoteOpen((on) => !on)}>
              +
            </button>
          </div>
          {noteOpen ? (
            <form className="tasks-form" onSubmit={onAddNote}>
              <label>
                Note
                <textarea rows={4} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              </label>
              {hint('note')}
              <button type="submit">Add</button>
            </form>
          ) : null}
          {log.length === 0 && !noteOpen ? <p className="muted">No notes yet.</p> : null}
          {log.map((note) => (
            <article key={note.id} className="tasks-note">
              <p className="tasks-kicker">{noteStamp(note.createdAt)}</p>
              <p>{note.body}</p>
            </article>
          ))}
        </section>

        <label>
          Project
          <select
            value={row.projectId ?? ''}
            onChange={(e) => patch.mutate({ body: { projectId: e.target.value }, field: 'project' })}
          >
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
          onChange={(people) => patch.mutate({ body: { personIds: relIds(people) }, field: 'people' })}
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
          {hint('kind')}
        </label>
        {manual ? (
          <label>
            External ID
            <input
              value={externalKey}
              onChange={(e) => setExternalKey(e.target.value)}
              onBlur={(e) => saveKey(e.currentTarget.value)}
              autoComplete="off"
            />
            {hint('key')}
          </label>
        ) : null}
        <div className="tasks-plan">
          <p className="tasks-kicker">Estimate</p>
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
          {hint('estimate')}
        </div>

        <section>
          <p className="tasks-kicker">Load</p>
          <p className="tasks-stat">
            <strong className="mono">{span(trackedLive)}</strong>
            <span>Tracked lifetime</span>
          </p>
          <p className="tasks-stat">
            <strong className="mono">{span(monthItem)}</strong>
            <span>This month</span>
          </p>
          {project ? (
            <>
              <p className="tasks-stat">
                <strong className="mono">{itemCost(usd, monthItem, monthProject, 'en-US')}</strong>
                <span>This month · $</span>
              </p>
              <p className="tasks-stat">
                <strong className="mono">{itemCost(rub, monthItem, monthProject, 'ru-RU')}</strong>
                <span>This month · ₽</span>
              </p>
              <p className="tasks-stat">
                <strong className="mono">{itemCost(usd, row.plannedSeconds, monthProject, 'en-US')}</strong>
                <span>If estimate · $</span>
              </p>
              <p className="tasks-stat">
                <strong className="mono">{itemCost(rub, row.plannedSeconds, monthProject, 'ru-RU')}</strong>
                <span>If estimate · ₽</span>
              </p>
            </>
          ) : null}
        </section>
      </details>

      <TaskConfirm
        open={kindConfirm != null}
        title="Type change resets status to Backlog"
        body="This type cannot keep the current status."
        confirmLabel="Change type"
        onCancel={() => setKindConfirm(null)}
        onConfirm={() => {
          if (kindConfirm) applyKind(kindConfirm)
          setKindConfirm(null)
        }}
      />
      <TaskConfirm
        open={modal === 'stall'}
        title={row.archivedAt ? 'Return this task to the board?' : 'Stall this task?'}
        body={row.archivedAt ? 'It will show in Active again.' : 'Hidden from schedule, priorities, and default lists.'}
        confirmLabel={row.archivedAt ? 'Restore' : 'Stall'}
        busy={patch.isPending}
        onCancel={() => setModal(null)}
        onConfirm={applyStall}
      />
      <TaskConfirm
        open={modal === 'delete'}
        title={`Delete “${row.externalKey || row.title}”?`}
        body="This hides it from sync."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onCancel={() => setModal(null)}
        onConfirm={() => remove.mutate()}
      />
      <TaskTimeLog itemId={id} open={modal === 'time'} onClose={() => setModal(null)} />
    </div>
  )
}
