import { Dumbbell } from 'lucide-react';

export function MuscleTabs({ activeMuscle, muscles, setActiveMuscle }) {
  if (!muscles.length) return null;

  return (
    <nav className="muscle-tabs" aria-label="Filter exercises by muscle">
      <button
        className={`muscle-tab ${activeMuscle === 'All' ? 'active' : ''}`}
        onClick={() => setActiveMuscle('All')}
        type="button"
      >
        <Dumbbell size={15} />
        All
      </button>
      {muscles.map((muscle) => (
        <button
          className={`muscle-tab ${activeMuscle === muscle ? 'active' : ''}`}
          key={muscle}
          onClick={() => setActiveMuscle(muscle)}
          type="button"
        >
          {muscle}
        </button>
      ))}
    </nav>
  );
}
