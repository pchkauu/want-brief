import type { EventOccurrence } from '../../types'
import { EventCard } from './EventCard'

type Props = {
  rows: EventOccurrence[]
  selectedId?: string
  onPick: (id: string) => void
}

export function DayColumn({ rows, selectedId, onPick }: Props) {
  if (rows.length === 0) {
    return <p className="events-empty">No slots this day.</p>
  }
  return (
    <div className="events-slots">
      {rows.map((row, index) => (
        <EventCard
          key={`${row.seriesId}-${row.startsAt}`}
          row={row}
          selected={row.seriesId === selectedId}
          delay={index}
          onPick={onPick}
        />
      ))}
    </div>
  )
}
