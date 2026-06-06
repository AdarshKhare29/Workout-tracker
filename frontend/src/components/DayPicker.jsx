import { CalendarDays } from 'lucide-react';
import { DAYS } from '../data/workoutPlan';
import { exerciseCountLabel } from '../utils/format';

export function DayPicker({ activeDay, plan, setActiveDay }) {
  return (
    <aside className="day-panel" aria-label="Choose training day">
      <div className="panel-title">
        <CalendarDays size={18} />
        <span>Week</span>
      </div>
      <div className="day-list">
        {DAYS.map((day) => (
          <button
            className={`day-button ${activeDay === day ? 'active' : ''}`}
            key={day}
            onClick={() => setActiveDay(day)}
            type="button"
          >
            <span>{day}</span>
            <small>{exerciseCountLabel(plan[day].exercises.length)}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
