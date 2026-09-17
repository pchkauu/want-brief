export type ItemKind =
  | 'task'
  | 'note'
  | 'agreement'
  | 'obligation'
  | 'initiative'
  | 'life'

export type Occupancy = 'solo' | 'parallel'

export type ItemStatus =
  | 'backlog'
  | 'needs_grooming'
  | 'to_do'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'qa'
  | 'awaiting_decision'
  | 'release_candidate'
  | 'done'
  | 'cancelled'
export type Quadrant = 'do' | 'schedule' | 'delegate' | 'drop'
export type SourceKind = 'jira' | 'todoist' | 'manual'

export type ProjectLink = {
  label: string
  url: string
}

export type PersonRel = {
  id: string
  comment: string
}

export type ContactKind = 'phone' | 'telegram' | 'url'
export type SiteKind = 'personal_site' | 'company_site' | 'github' | 'linkedin' | 'youtube' | 'telegram_channel' | 'other'
export type BondKind = 'acquaintance' | 'colleague' | 'comrade' | 'friend' | 'relative' | 'spouse' | 'adversary' | 'other'
export type BondAction = 'open' | 'change' | 'end'

export type PersonContact = {
  id: string
  personId: string
  kind: ContactKind
  label: string
  value: string
  note: string
  createdAt: string
  updatedAt: string
}

export type PersonSite = {
  id: string
  personId: string
  kind: SiteKind
  url: string
  comment: string
  createdAt: string
  updatedAt: string
}

export type PersonBondEvent = {
  id: string
  bondId: string
  action: BondAction
  kind: BondKind
  comment: string
  startedOn: string
  changedOn: string
  endedOn: string | null
  at: string
}

export type PersonBond = {
  id: string
  personAId: string | null
  personBId: string
  otherId: string | null
  otherName: string
  kind: BondKind
  comment: string
  startedOn: string
  changedOn: string
  endedOn: string | null
  events: PersonBondEvent[]
  createdAt: string
  updatedAt: string
}

export type MeBond = {
  id: string
  kind: BondKind
}

export type SalaryPeriod = {
  id: string
  professionId: string
  startedOn: string
  endedOn: string | null
  monthlySalaryUsd: number
  monthlySalaryRub: number
}

export type PersonProfession = {
  id: string
  personId: string
  title: string
  comment: string
  startedOn: string
  endedOn: string | null
  salaries: SalaryPeriod[]
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  color: string
  description: string
  monthlyIncomeUsd: number
  monthlyIncomeRub: number
  targetHoursDay: number
  targetHoursWeek: number
  links: ProjectLink[]
  people: PersonRel[]
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type Person = {
  id: string
  name: string
  bornOn: string | null
  age: number | null
  projects: PersonRel[]
  events: PersonRel[]
  itemIds: string[]
  contacts: PersonContact[]
  sites: PersonSite[]
  bonds: PersonBond[]
  professions: PersonProfession[]
  meBond: MeBond | null
  lastNoteAt: string | null
  createdAt: string
  updatedAt: string
}

export type PersonNote = {
  id: string
  personId: string
  body: string
  createdAt: string
}

export type ProjectNote = {
  id: string
  projectId: string
  body: string
  createdAt: string
}

export type Source = {
  id: string
  kind: SourceKind
  name: string
  baseUrl: string
  hasToken: boolean
  email?: string
  query: string
  projectId: string | null
	connected: boolean
	insecureTls?: boolean
	lastError?: string
  lastSyncAt: string | null
}

export type Item = {
  id: string
  sourceId: string
  externalKey: string
  title: string
  status: ItemStatus
  occupancy: Occupancy
  externalStatus: string
  kind: ItemKind
  projectId: string | null
  urgent: boolean
  important: boolean
  pinned: boolean
  stress: number | null
  dueAt: string | null
  devDueAt: string | null
  reviewDueAt: string | null
  testDueAt: string | null
  description: string
  plannedSeconds: number
  links: ProjectLink[]
  trackedSeconds: number
  archivedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  sourceName: string
  sourceKind: SourceKind
  projectName: string
  projectColor: string
  quadrant: Quadrant
  personIds: string[]
  checkTotal: number
  checkDone: number
}

export type CheckinKind = 'stress' | 'focus' | 'energy' | 'interest'

export type LatestCheckins = {
  stress: number
  focus: number
  energy: number
  interest: number
}

export type EventKind = 'event' | 'call'
export type EventType =
  | 'sync'
  | 'grooming'
  | 'lesson'
  | 'mentorship'
  | 'planning'
  | 'daily'
  | 'retro'
  | 'one_on_one'
  | 'global'
  | 'team_building'
  | 'external'
export type EventRecurrence = 'once' | 'weekly' | 'monthly'

export type CalendarEvent = EventOccurrence

export type EventOccurrence = {
  id: string
  seriesId: string
  title: string
  description: string
  agenda: string
  kind: EventKind
  type: EventType
  projectId: string | null
  startsAt: string
  endsAt: string
  durationSeconds: number
  recurrence: EventRecurrence
  links: ProjectLink[]
  meetUrl: string
  involvement: number
  activeStartOffset: number | null
  activeEndOffset: number | null
  canSkip: boolean
  people: PersonRel[]
  createdAt: string
}

export type EventSeries = {
  id: string
  title: string
  description: string
  agenda: string
  kind: EventKind
  type: EventType
  projectId: string | null
  startsAt: string
  durationSeconds: number
  recurrence: EventRecurrence
  links: ProjectLink[]
  meetUrl: string
  involvement: number
  activeStartOffset: number | null
  activeEndOffset: number | null
  canSkip: boolean
  people: PersonRel[]
  createdAt: string
  updatedAt: string
}

export const EVENT_TYPES: EventType[] = [
  'sync',
  'grooming',
  'lesson',
  'mentorship',
  'planning',
  'daily',
  'retro',
  'one_on_one',
  'global',
  'team_building',
  'external',
]

export function eventTypeLabel(type: EventType): string {
  switch (type) {
    case 'one_on_one':
      return '1-1'
    case 'team_building':
      return 'Team-building'
    case 'external':
      return 'External'
    default:
      return type.replaceAll('_', ' ')
  }
}

export function recurrenceLabel(recurrence: EventRecurrence, startsAt: string): string {
  if (recurrence === 'once') return 'Once'
  if (recurrence === 'monthly') return 'Monthly'
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(startsAt))
  return `Every ${day}`
}

export type ItemCheck = {
  id: string
  itemId: string
  body: string
  done: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export type ItemNote = {
  id: string
  itemId: string
  body: string
  sourceKind: SourceKind
  createdAt: string
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
  averages: {
    stress: number | null
    focus: number | null
    energy: number | null
    interest: number | null
  }
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
  byDay: { date: string; allocatedSeconds: number; wallSeconds: number }[]
  stress: { id: string; kind: CheckinKind; level: number; loggedAt: string; itemId: string | null }[]
}

export type JournalSource = 'loose' | 'project' | 'item' | 'person'

export type JournalEntry = {
  id: string
  source: JournalSource
  ownerId: string | null
  ownerName: string
  body: string
  createdAt: string
}

export type ScheduleBlock = {
  itemId: string
  title: string
  externalKey: string
  startsAt: string
  endsAt: string
  late: boolean
  continued: boolean
  continues: boolean
  lane: number
  occupancy: Occupancy
  pinned: boolean
  quadrant: Quadrant
  dueAt: string
  stress: number | null
  remainingSeconds: number
}

export type ScheduleLane = {
  projectId: string | null
  projectName: string
  projectColor: string
  blocks: ScheduleBlock[]
}

export type ScheduleBusy = {
  startsAt: string
  endsAt: string
  title: string
  seriesId?: string
}

export type UnplannedItem = {
  item: Item
  missingDevDue: boolean
  missingPlan: boolean
}

export type ScheduleOverflow = {
  itemCount: number
  seconds: number
  firstDueAt: string | null
}

export type ScheduleCapacity = {
  freeSeconds: number
  packedSeconds: number
  busySeconds: number
}

export type Schedule = {
  lanes: ScheduleLane[]
  unplanned: UnplannedItem[]
  busy: ScheduleBusy[]
  overflow: ScheduleOverflow
  capacity: ScheduleCapacity
}

export const KINDS: ItemKind[] = [
  'task',
  'note',
  'agreement',
  'obligation',
  'initiative',
  'life',
]

export const ITEM_STATUSES: ItemStatus[] = [
  'backlog',
  'needs_grooming',
  'to_do',
  'in_progress',
  'blocked',
  'review',
  'qa',
  'awaiting_decision',
  'release_candidate',
  'done',
  'cancelled',
]

export function statusesForKind(kind: ItemKind): ItemStatus[] {
  if (kind === 'task') return ITEM_STATUSES
  return ['backlog', 'needs_grooming', 'to_do', 'in_progress', 'blocked', 'done', 'cancelled']
}

export function kindLabel(kind: ItemKind): string {
  if (kind === 'task') return 'IT-ticket'
  return kind
}

export function occupancyLabel(occupancy: Occupancy): string {
  return occupancy === 'parallel' ? 'Parallel' : 'Solo'
}

export function sourceKindLabel(kind: SourceKind): string {
  if (kind === 'jira') return 'Jira'
  if (kind === 'todoist') return 'Todoist'
  return 'Manual'
}

const STATUS_LABELS: Record<ItemStatus, string> = {
  backlog: 'Backlog',
  needs_grooming: 'Needs grooming',
  to_do: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  review: 'Review',
  qa: 'QA',
  awaiting_decision: 'Awaiting decision',
  release_candidate: 'Release candidate',
  done: 'Done',
  cancelled: 'Cancelled',
}

export function statusLabel(status: ItemStatus): string {
  return STATUS_LABELS[status] ?? status.replaceAll('_', ' ')
}
