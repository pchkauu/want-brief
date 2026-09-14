import type {
  Item,
  ItemKind,
  ItemStatus,
  LoadReport,
  Note,
  Project,
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
  createProject: (body: { name: string; color: string; targetHoursWeek: number }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  patchProject: (id: string, body: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  sources: () => request<Source[]>('/api/sources'),
  createSource: (body: {
    kind: string
    name: string
    baseUrl?: string
    token?: string
    query?: string
  }) => request<Source>('/api/sources', { method: 'POST', body: JSON.stringify(body) }),
  patchSource: (id: string, body: Record<string, string>) =>
    request<Source>(`/api/sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSource: (id: string) => request(`/api/sources/${id}`, { method: 'DELETE' }),
  syncSource: (id: string) =>
    request<{ upserted: number }>(`/api/sources/${id}/sync`, { method: 'POST' }),
  items: (query?: { sourceId?: string; projectId?: string; kind?: ItemKind; status?: ItemStatus }) => {
    const params = new URLSearchParams()
    if (query?.sourceId) params.set('sourceId', query.sourceId)
    if (query?.projectId) params.set('projectId', query.projectId)
    if (query?.kind) params.set('kind', query.kind)
    if (query?.status) params.set('status', query.status)
    const suffix = params.toString() ? `?${params}` : ''
    return request<Item[]>(`/api/items${suffix}`)
  },
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
  stopInterval: (id: string) =>
    request<TimeInterval>(`/api/intervals/${id}/stop`, { method: 'POST' }),
  createStress: (level: number, itemId?: string) =>
    request('/api/stress', { method: 'POST', body: JSON.stringify({ level, itemId }) }),
  load: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const suffix = params.toString() ? `?${params}` : ''
    return request<LoadReport>(`/api/load${suffix}`)
  },
}
