export type ItemKind =
  | 'task'
  | 'note'
  | 'agreement'
  | 'obligation'
  | 'initiative'
  | 'life'

export type ItemStatus = 'open' | 'done'
export type Quadrant = 'do' | 'schedule' | 'delegate' | 'drop'
export type SourceKind = 'jira' | 'todoist' | 'local'

export type Project = {
  id: string
  name: string
  color: string
  targetHoursWeek: number
}

export type Source = {
  id: string
  kind: SourceKind
  name: string
  baseUrl: string
  hasToken: boolean
  query: string
  lastSyncAt: string | null
}

export type Item = {
  id: string
  sourceId: string
  externalKey: string
  title: string
  status: ItemStatus
  kind: ItemKind
  projectId: string | null
  urgent: boolean
  important: boolean
  stress: number | null
  dueAt: string | null
  sourceName: string
  sourceKind: SourceKind
  projectName: string
  projectColor: string
  quadrant: Quadrant
}

export type Note = {
  id: string
  itemId: string | null
  body: string
  updatedAt: string
}

export type TimeInterval = {
  id: string
  itemId: string
  startedAt: string
  endedAt: string | null
}

export type LoadReport = {
  from: string
  to: string
  allocatedSeconds: number
  wallSeconds: number
  averageStress: number | null
  byProject: {
    projectId: string | null
    name: string
    color: string
    targetHoursWeek: number
    allocatedSeconds: number
  }[]
  byItem: {
    itemId: string
    title: string
    kind: ItemKind
    projectName: string
    allocatedSeconds: number
  }[]
  stress: { id: string; level: number; loggedAt: string; itemId: string | null }[]
}

export const KINDS: ItemKind[] = [
  'task',
  'note',
  'agreement',
  'obligation',
  'initiative',
  'life',
]
