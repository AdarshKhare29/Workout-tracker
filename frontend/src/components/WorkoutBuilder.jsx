import { Plus, Trash2 } from 'lucide-react';

export function WorkoutBuilder({
  activeMuscle,
  addExercise,
  addMuscle,
  dayPlan,
  exerciseInput,
  exerciseMuscles,
  muscleInput,
  removeMuscle,
  setExerciseInput,
  setExerciseMuscles,
  setMuscleInput,
}) {
  return (
    <div className="builder-grid">
      <form className="tool-panel" onSubmit={addMuscle}>
        <label htmlFor="muscle">Muscles</label>
        <div className="input-row">
          <input
            id="muscle"
            onChange={(event) => setMuscleInput(event.target.value)}
            placeholder="Back, Biceps, Chest..."
            value={muscleInput}
          />
          <button aria-label="Add muscle" className="icon-button primary" type="submit">
            <Plus size={18} />
          </button>
        </div>
        <div className="chip-list">
          {dayPlan.muscles.length ? (
            dayPlan.muscles.map((muscle) => (
              <span className="chip" key={muscle}>
                <span>{muscle}</span>
                <button aria-label={`Remove ${muscle}`} onClick={() => removeMuscle(muscle)} type="button">
                  <Trash2 size={13} />
                </button>
              </span>
            ))
          ) : (
            <p className="muted">No muscles added yet.</p>
          )}
        </div>
      </form>

      <form className="tool-panel" onSubmit={addExercise}>
        <label htmlFor="exercise">Exercises</label>
        <input
          id="exercise"
          onChange={(event) => setExerciseInput(event.target.value)}
          placeholder="Exercise name"
          value={exerciseInput}
        />
        <div className="muscle-field">
          <label htmlFor="exercise-muscle">Muscle group</label>
          <input
            aria-label="Exercise muscle group"
            id="exercise-muscle"
            list="muscle-options"
            onChange={(event) => setExerciseMuscles(event.target.value)}
            placeholder={activeMuscle !== 'All' ? activeMuscle : dayPlan.muscles[0] || 'General'}
            value={exerciseMuscles}
          />
          <datalist id="muscle-options">
            {dayPlan.muscles.map((muscle) => (
              <option key={muscle} value={muscle} />
            ))}
          </datalist>
        </div>
        <button className="text-button primary" type="submit">
          <Plus size={17} />
          Add exercise
        </button>
      </form>
    </div>
  );
}
