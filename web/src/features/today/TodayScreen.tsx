import type { CSSProperties } from 'react'
import { Window } from '../../shared/Window'
import { ClockRow } from './ClockRow'
import { EventList } from './EventList'
import { MatrixPreview } from './MatrixPreview'
import { ProjectPeriods } from './ProjectPeriods'
import './today.css'

function todayKicker(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  }).format(now)
}

export function TodayScreen() {
  return (
    <Window className="today-window" kicker={todayKicker()} title="Today">
      <div className="today-bento">
        <div className="today-tile today-clocks" style={{ '--d': 0 } as CSSProperties}>
          <div className="today-core">
            <ClockRow />
          </div>
        </div>
        <div className="today-tile today-priorities" style={{ '--d': 1 } as CSSProperties}>
          <div className="today-core">
            <MatrixPreview />
          </div>
        </div>
        <div className="today-tile today-schedule" style={{ '--d': 2 } as CSSProperties}>
          <div className="today-core">
            <EventList />
          </div>
        </div>
        <div className="today-tile today-projects" style={{ '--d': 3 } as CSSProperties}>
          <div className="today-core">
            <ProjectPeriods />
          </div>
        </div>
      </div>
    </Window>
  )
}
