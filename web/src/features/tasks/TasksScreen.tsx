import { useCallback, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { dueWithinWeek, itemCost } from '../../shared/format'
import { moscowRange } from '../../shared/moscow'
import {
  ITEM_STATUSES,
  KINDS,
  kindLabel,
  statusLabel,
  statusesForKind,
  type Item,
  type ItemKind,
  type ItemStatus,
  type LoadReport,
  type Project,
} from '../../types'
import { DRAG_TYPE, TaskCard, decodeTaskDrag } from './TaskCard'
import { TaskLogProvider, useTaskLogPrompt } from './TaskLogPrompt'
import { TaskDossierSheet } from './TaskPage'
import { TaskSheet } from './TaskSheet'

function columnsFor(showDone: boolean): ItemStatus[] {
  if (showDone) return ITEM_STATUSES
  return ITEM_STATUSES.filter((status) => status !== 'done' && status !== 'cancelled')
}

function monthSeconds(rows: { itemId: string; allocatedSeconds: number }[] | undefined, id: string): number {
  return rows?.find((row) => row.itemId === id)?.allocatedSeconds ?? 0
}

function projectMonth(rows: { projectId: string | null; allocatedSeconds: number }[] | undefined, id: string | null): number {
  if (!id) return 0
  return rows?.find((row) => row.projectId === id)?.allocatedSeconds ?? 0
}

function cardYield(item: Item, projects: Project[], load: LoadReport | undefined) {
  const project = projects.find((entry) => entry.id === item.projectId)
  if (!project) return undefined
  const monthProject = projectMonth(load?.byProject, item.projectId)
  if (monthProject <= 0) return undefined
  const monthItem = monthSeconds(load?.byItem, item.id)
  if (monthItem <= 0) return undefined
  return {
    usd: itemCost(project.monthlyIncomeUsd, monthItem, monthProject, 'en-US'),
    rub: itemCost(project.monthlyIncomeRub, monthItem, monthProject, 'ru-RU'),
  }
}

export function TasksScreen() {
  return (
    <TaskLogProvider>
      <TasksWorkspace />
    </TaskLogProvider>
  )
}

function TasksWorkspace() {
  const promptLog = useTaskLogPrompt()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const closeDossier = useCallback(() => navigate('/tasks'), [navigate])
  const [sourceId, setSourceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [kind, setKind] = useState<ItemKind | ''>('')
  const [query, setQuery] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [stall, setStall] = useState<'active' | 'stalled' | 'all'>('active')
  const [onlyU, setOnlyU] = useState(false)
  const [onlyI, setOnlyI] = useState(false)
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [open, setOpen] = useState(false)
  const [createStatus, setCreateStatus] = useState<ItemStatus>('backlog')
  const [dropStatus, setDropStatus] = useState<ItemStatus | null>(null)
  const [title, setTitle] = useState('')
  const [newKind, setNewKind] = useState<ItemKind>('task')
  const [formError, setFormError] = useState('')
  const sources = useQuery({ queryKey: ['sources'], queryFn: api.sources })
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const monthLoad = useQuery({
    queryKey: ['load', 'month'],
    queryFn: () => {
      const bounds = moscowRange('month')
      return api.load(bounds.from, bounds.to)
    },
  })
  const items = useQuery({
    queryKey: ['items', sourceId, projectId, kind, showDone, stall],
    queryFn: () =>
      api.items({
        sourceId: sourceId || undefined,
        projectId: projectId || undefined,
        kind: kind || undefined,
        openOnly: !showDone,
        includeArchived: stall === 'all',
        archivedOnly: stall === 'stalled',
      }),
  })
  const intervals = useQuery({ queryKey: ['intervals'], queryFn: api.intervals, refetchInterval: 1000 })
  const create = useMutation({
    mutationFn: async () => {
      const item = await api.createItem({ title: title.trim(), kind: newKind })
      if (createStatus === 'backlog') return item
      if (!statusesForKind(newKind).includes(createStatus)) return item
      return api.patchItem(item.id, { status: createStatus })
    },
    onSuccess: (item) => {
      setTitle('')
      setFormError('')
      setOpen(false)
      setCreateStatus('backlog')
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      navigate(`/tasks/${item.id}`)
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Could not add.'),
  })
  const move = useMutation({
    mutationFn: ({ id: itemId, status }: { id: string; status: ItemStatus }) => api.patchItem(itemId, { status }),
    onSuccess: (_row, vars) => {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['items'] })
        promptLog(vars.id)
      }, 0)
    },
  })

  function openCreate(status: ItemStatus) {
    setCreateStatus(status)
    const allowed = KINDS.filter((value) => statusesForKind(value).includes(status))
    setNewKind(allowed.includes(newKind) ? newKind : (allowed[0] ?? 'task'))
    setFormError('')
    setOpen(true)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setFormError('Title is required.')
      return
    }
    setFormError('')
    create.mutate()
  }

  function payloadFrom(event: DragEvent): { id: string; kind: Item['kind'] } | null {
    return decodeTaskDrag(event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData('text/plain'))
  }

  function onDragOver(status: ItemStatus, event: DragEvent) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropStatus(status)
  }

  function onDrop(status: ItemStatus, event: DragEvent) {
    event.preventDefault()
    setDropStatus(null)
    const payload = payloadFrom(event)
    if (!payload || !statusesForKind(payload.kind).includes(status)) return
    const current = (items.data ?? []).find((item) => item.id === payload.id)
    if (current?.status === status) return
    move.mutate({ id: payload.id, status })
  }

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const now = Date.now()
    return (items.data ?? []).filter((item) => {
      if (needle && !`${item.externalKey} ${item.title}`.toLowerCase().includes(needle)) return false
      if (onlyU && !item.urgent) return false
      if (onlyI && !item.important) return false
      if (urgentOnly && !(item.urgent && item.important && dueWithinWeek(item.dueAt, now))) return false
      return true
    })
  }, [items.data, query, onlyU, onlyI, urgentOnly, intervals.dataUpdatedAt])
  const runningByItem = new Map((intervals.data ?? []).map((row) => [row.itemId, row]))

  const columns = columnsFor(showDone)
  const grouped = useMemo(() => {
    const buckets: Record<ItemStatus, Item[]> = {
      backlog: [],
      needs_grooming: [],
      to_do: [],
      in_progress: [],
      blocked: [],
      review: [],
      qa: [],
      awaiting_decision: [],
      release_candidate: [],
      done: [],
      cancelled: [],
    }
    for (const item of list) {
      buckets[item.status]?.push(item)
    }
    for (const status of Object.keys(buckets) as ItemStatus[]) {
      buckets[status].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return buckets
  }, [list])

  const createKinds = KINDS.filter((value) => statusesForKind(value).includes(createStatus))
  const projectList = projects.data ?? []

  return (
    <div className="tasks">
      <header className="tasks-bar">
        <h1>Task</h1>
        <label className="tasks-search">
          Search
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title or key"
            autoComplete="off"
          />
        </label>
        <label className="tasks-toggle">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show done
        </label>
        <label className="tasks-toggle">
          Stall
          <select value={stall} onChange={(e) => setStall(e.target.value as 'active' | 'stalled' | 'all')} aria-label="Stall filter">
            <option value="active">Active</option>
            <option value="stalled">Stalled</option>
            <option value="all">All</option>
          </select>
        </label>
        <div className="tasks-chips">
          <button type="button" className={onlyU ? 'chip on' : 'chip'} onClick={() => setOnlyU((on) => !on)}>
            U
          </button>
          <button type="button" className={onlyI ? 'chip on' : 'chip'} onClick={() => setOnlyI((on) => !on)}>
            I
          </button>
          <button type="button" className={urgentOnly ? 'chip on' : 'chip'} onClick={() => setUrgentOnly((on) => !on)}>
            Urgent
          </button>
        </div>
        <div className="tasks-filters">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
            <option value="">All projects</option>
            {projectList.map((project) => (
              <option key={project.id} value={project.id}>
                {project.archivedAt ? `${project.name} (archived)` : project.name}
              </option>
            ))}
          </select>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} aria-label="Source">
            <option value="">All sources</option>
            {(sources.data ?? []).map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind | '')} aria-label="Type">
            <option value="">All types</option>
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {kindLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="tasks-plus" aria-label="Add task" onClick={() => openCreate('backlog')}>
          +
        </button>
      </header>
      {items.isLoading ? <p className="muted">Loading…</p> : null}
      {items.isError ? <p className="error">{items.error.message}</p> : null}
      {!items.isLoading && !items.isError ? (
        <div className="tasks-kanban" onDragEnd={() => setDropStatus(null)}>
          {columns.map((status) => (
            <section
              key={status}
              className={dropStatus === status ? 'tasks-col drop' : 'tasks-col'}
              onDragOver={(event) => onDragOver(status, event)}
              onDrop={(event) => onDrop(status, event)}
            >
              <header className="tasks-col-head">
                <h2>
                  {statusLabel(status)} <span>{grouped[status].length}</span>
                </h2>
                <button
                  type="button"
                  className="tasks-plus"
                  aria-label={`Add to ${statusLabel(status)}`}
                  onClick={() => openCreate(status)}
                >
                  +
                </button>
              </header>
              {grouped[status].map((item) => {
                const yieldRow = cardYield(item, projectList, monthLoad.data)
                return (
                  <TaskCard
                    key={item.id}
                    item={item}
                    running={runningByItem.get(item.id)}
                    yieldUsd={yieldRow?.usd}
                    yieldRub={yieldRow?.rub}
                  />
                )
              })}
            </section>
          ))}
        </div>
      ) : null}
      <TaskSheet
        open={open}
        title={createStatus === 'backlog' ? 'Add task' : `Add to ${statusLabel(createStatus)}`}
        onClose={() => {
          setOpen(false)
          setCreateStatus('backlog')
          setFormError('')
        }}
      >
        <form className="tasks-form" onSubmit={onSubmit}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" autoFocus />
          </label>
          <label>
            Type
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as ItemKind)}>
              {createKinds.map((value) => (
                <option key={value} value={value}>
                  {kindLabel(value)}
                </option>
              ))}
            </select>
          </label>
          {formError ? <p className="error">{formError}</p> : null}
          <button type="submit">Create</button>
        </form>
      </TaskSheet>
      {id ? <TaskDossierSheet id={id} onClose={closeDossier} /> : null}
    </div>
  )
}
