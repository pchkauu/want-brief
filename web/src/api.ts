import type {
  CalendarEvent,
  EventSeries,
  CheckinKind,
  Person,
  PersonNote,
  Item,
  ItemKind,
  ItemNote,
  ItemStatus,
  JournalEntry,
  LatestCheckins,
  LoadReport,
  Note,
  Project,
  ProjectNote,
  Schedule,
  Source,
  TimeInterval,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (response.status === 204) {
    return undefined as T
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  return data
}

export const api = {
  login: (password: string) =>
    request<{ ok: boolean }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () => request('/api/logout', { method: 'POST' }),
  me: () => request<{ ok: boolean }>('/api/me'),
  projects: () => request<Project[]>('/api/projects'),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (body: { name: string; color?: string }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<Project> & { archived?: boolean }) =>
    request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  projectNotes: (id: string) => request<ProjectNote[]>(`/api/projects/${id}/notes`),
  createProjectNote: (id: string, body: string) =>
    request<ProjectNote>(`/api/projects/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
  deleteProjectNote: (id: string, noteId: string) =>
    request(`/api/projects/${id}/notes/${noteId}`, { method: 'DELETE' }),
  sources: () => request<Source[]>('/api/sources'),
  createSource: (body: {
    kind: string
    name: string
    baseUrl?: string
    token?: string
    email?: string
    projectId: string
    insecureTls?: boolean
  }) => request<Source>('/api/sources', { method: 'POST', body: JSON.stringify(body) }),
  patchSource: (id: string, body: Record<string, string | boolean>) =>
    request<Source>(`/api/sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSource: (id: string) => request(`/api/sources/${id}`, { method: 'DELETE' }),
  syncSource: (id: string) =>
    request<{ upserted: number }>(`/api/sources/${id}/sync`, { method: 'POST' }),
  items: (query?: {
    sourceId?: string
    projectId?: string
    kind?: ItemKind
    status?: ItemStatus
    openOnly?: boolean
    includeArchived?: boolean
  }) => {
    const params = new URLSearchParams()
    if (query?.sourceId) params.set('sourceId', query.sourceId)
    if (query?.projectId) params.set('projectId', query.projectId)
    if (query?.kind) params.set('kind', query.kind)
    if (query?.status) params.set('status', query.status)
    if (query?.openOnly) params.set('openOnly', 'true')
    if (query?.includeArchived) params.set('includeArchived', 'true')
    const suffix = params.toString() ? `?${params}` : ''
    return request<Item[]>(`/api/items${suffix}`)
  },
  item: (id: string) => request<Item>(`/api/items/${id}`),
  createItem: (body: {
    title: string
    kind: ItemKind
    projectId?: string
    urgent?: boolean
    important?: boolean
  }) => request<Item>('/api/items', { method: 'POST', body: JSON.stringify(body) }),
  patchItem: (id: string, body: Record<string, unknown>) =>
    request<Item>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteItem: (id: string) => request(`/api/items/${id}`, { method: 'DELETE' }),
  itemNotes: (id: string) => request<ItemNote[]>(`/api/items/${id}/notes`),
  createItemNote: (id: string, body: string) =>
    request<ItemNote>(`/api/items/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
  deleteItemNote: (id: string, noteId: string) =>
    request(`/api/items/${id}/notes/${noteId}`, { method: 'DELETE' }),
  notes: (itemId?: string) => {
    const suffix = itemId ? `?itemId=${itemId}` : ''
    return request<Note[]>(`/api/notes${suffix}`)
  },
  createNote: (body: string, itemId?: string) =>
    request<Note>('/api/notes', { method: 'POST', body: JSON.stringify({ body, itemId }) }),
  patchNote: (id: string, body: string) =>
    request<Note>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  deleteNote: (id: string) => request(`/api/notes/${id}`, { method: 'DELETE' }),
  intervals: () => request<TimeInterval[]>('/api/intervals'),
  startInterval: (itemId: string) =>
    request<TimeInterval>('/api/intervals', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),
  logInterval: (itemId: string, startedAt: string, endedAt: string) =>
    request<TimeInterval>('/api/intervals', {
      method: 'POST',
      body: JSON.stringify({ itemId, startedAt, endedAt }),
    }),
  stopInterval: (id: string) =>
    request<TimeInterval>(`/api/intervals/${id}/stop`, { method: 'POST' }),
  createStress: (level: number, itemId?: string) =>
    request('/api/stress', { method: 'POST', body: JSON.stringify({ level, itemId }) }),
  latestCheckins: () => request<LatestCheckins>('/api/checkins/latest'),
  createCheckin: (kind: CheckinKind, level: number) =>
    request('/api/checkins', { method: 'POST', body: JSON.stringify({ kind, level }) }),
  events: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const suffix = params.toString() ? `?${params}` : ''
    return request<CalendarEvent[]>(`/api/events${suffix}`)
  },
  event: (id: string) => request<EventSeries>(`/api/events/${id}`),
  createEvent: (body: Record<string, unknown>) =>
    request<EventSeries>('/api/events', { method: 'POST', body: JSON.stringify(body) }),
  patchEvent: (id: string, body: Record<string, unknown>) =>
    request<EventSeries>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEvent: (id: string) => request(`/api/events/${id}`, { method: 'DELETE' }),
  eventSeries: () => request<EventSeries[]>('/api/event-series'),
  people: () => request<Person[]>('/api/people'),
  person: (id: string) => request<Person>(`/api/people/${id}`),
  createPerson: (body: Record<string, unknown>) =>
    request<Person>('/api/people', { method: 'POST', body: JSON.stringify(body) }),
  patchPerson: (id: string, body: Record<string, unknown>) =>
    request<Person>(`/api/people/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePerson: (id: string) => request(`/api/people/${id}`, { method: 'DELETE' }),
  personNotes: (id: string) => request<PersonNote[]>(`/api/people/${id}/notes`),
  createPersonNote: (id: string, body: string) =>
    request<PersonNote>(`/api/people/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
  deletePersonNote: (id: string, noteId: string) =>
    request(`/api/people/${id}/notes/${noteId}`, { method: 'DELETE' }),
  load: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const suffix = params.toString() ? `?${params}` : ''
    return request<LoadReport>(`/api/load${suffix}`)
  },
  schedule: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to })
    return request<Schedule>(`/api/schedule?${params}`)
  },
  journal: () => request<JournalEntry[]>('/api/journal'),
}
