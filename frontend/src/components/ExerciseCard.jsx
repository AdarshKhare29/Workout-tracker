import { ChevronDown, ChevronUp, History, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const formatSet = (set) => {
  const weight = set.weight || '-';
  const reps = set.reps || '-';
  return `${weight} kg x ${reps}`;
};

export function ExerciseCard({
  addSession,
  addSet,
  exercise,
  removeExercise,
  removeSession,
  removeSet,
  updateSessionDate,
  updateSet,
}) {
  const [showAllSessions, setShowAllSessions] = useState(false);
  const previousSession = exercise.sessions[1];
  const hiddenSessionCount = Math.max(exercise.sessions.length - 1, 0);
  const visibleSessions = showAllSessions ? exercise.sessions : exercise.sessions.slice(0, 1);

  return (
    <article className="exercise-card">
      <header className="exercise-header">
        <div>
          <p>{exercise.muscles}</p>
          <h3>{exercise.name}</h3>
        </div>
        <div className="header-actions">
          <button className="text-button" onClick={() => addSession(exercise.id)} type="button">
            <History size={16} />
            New session
          </button>
          <button
            aria-label={`Delete ${exercise.name}`}
            className="icon-button danger"
            onClick={() => removeExercise(exercise.id)}
            type="button"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </header>

      {exercise.sessions.length ? (
        <div className="session-list">
          {previousSession ? (
            <div className="previous-session-reference">
              <div>
                <span>Previous session</span>
                <strong>{previousSession.date}</strong>
              </div>
              <div className="previous-set-list">
                {previousSession.sets.length ? (
                  previousSession.sets.map((set, setIndex) => (
                    <span className="previous-set" key={set.id}>
                      Set {setIndex + 1}: {formatSet(set)}
                    </span>
                  ))
                ) : (
                  <span className="previous-set">No sets logged</span>
                )}
              </div>
            </div>
          ) : null}

          {visibleSessions.map((session) => {
            const sessionIndex = exercise.sessions.findIndex((item) => item.id === session.id);
            return (
            <section className="session" key={session.id}>
              <div className="session-header">
                <div>
                  <span>Session {exercise.sessions.length - sessionIndex}</span>
                  <input
                    aria-label={`Date for ${exercise.name} session`}
                    onChange={(event) => updateSessionDate(exercise.id, session.id, event.target.value)}
                    type="date"
                    value={session.date}
                  />
                </div>
                <button
                  aria-label="Delete session"
                  className="icon-button"
                  onClick={() => removeSession(exercise.id, session.id)}
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="set-table">
                <div className="set-row set-head">
                  <span>Set</span>
                  <span>Weight</span>
                  <span>Reps</span>
                  <span></span>
                </div>
                {session.sets.map((set, setIndex) => (
                  <div className="set-row" key={set.id}>
                    <span>{setIndex + 1}</span>
                    <input
                      aria-label={`Weight for set ${setIndex + 1}`}
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => updateSet(exercise.id, session.id, set.id, 'weight', event.target.value)}
                      placeholder="kg"
                      type="number"
                      value={set.weight}
                    />
                    <input
                      aria-label={`Reps for set ${setIndex + 1}`}
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => updateSet(exercise.id, session.id, set.id, 'reps', event.target.value)}
                      placeholder="reps"
                      type="number"
                      value={set.reps}
                    />
                    <button
                      aria-label="Delete set"
                      className="icon-button"
                      onClick={() => removeSet(exercise.id, session.id, set.id, setIndex + 1)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="text-button compact" onClick={() => addSet(exercise.id, session.id)} type="button">
                <Plus size={15} />
                Add set
              </button>
            </section>
            );
          })}

          {hiddenSessionCount ? (
            <button
              className="text-button history-toggle"
              onClick={() => setShowAllSessions((current) => !current)}
              type="button"
            >
              {showAllSessions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showAllSessions ? 'Hide previous sessions' : `Show ${hiddenSessionCount} previous sessions`}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="no-session">
          <p>No sessions logged yet.</p>
          <button className="text-button primary" onClick={() => addSession(exercise.id)} type="button">
            <Plus size={16} />
            Log first session
          </button>
        </div>
      )}
    </article>
  );
}
