import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, CalendarDays, Dumbbell, Layers3, Save } from 'lucide-react';
import { DayPicker } from './components/DayPicker';
import { ExerciseCard } from './components/ExerciseCard';
import { MuscleTabs } from './components/MuscleTabs';
import { Stat } from './components/Stat';
import { WorkoutBuilder } from './components/WorkoutBuilder';
import { splitMuscleList } from './data/workoutPlan';
import { useWorkoutPlan } from './hooks/useWorkoutPlan';
import { makeId } from './utils/ids';
import './styles.css';

function App() {
  const { plan, saveState, setPlan } = useWorkoutPlan();
  const [activeDay, setActiveDay] = useState('Monday');
  const [muscleInput, setMuscleInput] = useState('');
  const [exerciseInput, setExerciseInput] = useState('');
  const [exerciseMuscles, setExerciseMuscles] = useState('');
  const [activeMuscle, setActiveMuscle] = useState('All');

  const dayPlan = plan[activeDay];
  const muscleGroups = useMemo(() => splitMuscleList(dayPlan.muscles), [dayPlan.muscles]);
  const normalizedDayPlan = useMemo(() => ({ ...dayPlan, muscles: muscleGroups }), [dayPlan, muscleGroups]);

  useEffect(() => {
    setActiveMuscle('All');
  }, [activeDay]);

  useEffect(() => {
    if (activeMuscle !== 'All' && !muscleGroups.includes(activeMuscle)) {
      setActiveMuscle('All');
    }
  }, [activeMuscle, muscleGroups]);

  const stats = useMemo(() => {
    const exercises = Object.values(plan).flatMap((day) => day.exercises);
    const sessions = exercises.flatMap((exercise) => exercise.sessions);
    const sets = sessions.flatMap((session) => session.sets);
    const totalVolume = sets.reduce((sum, set) => sum + Number(set.weight || 0) * Number(set.reps || 0), 0);

    return {
      exercises: exercises.length,
      sessions: sessions.length,
      sets: sets.length,
      volume: totalVolume,
    };
  }, [plan]);

  const updateDay = (day, updater) => {
    setPlan((current) => ({
      ...current,
      [day]: updater(current[day]),
    }));
  };

  const addMuscle = (event) => {
    event.preventDefault();
    const muscles = splitMuscleList([muscleInput]);
    if (!muscles.length) return;

    updateDay(activeDay, (current) => ({
      ...current,
      muscles: splitMuscleList([...current.muscles, ...muscles]),
    }));
    setMuscleInput('');
  };

  const removeMuscle = (muscle) => {
    updateDay(activeDay, (current) => ({
      ...current,
      muscles: splitMuscleList(current.muscles).filter((item) => item !== muscle),
    }));
  };

  const filteredExercises = useMemo(() => {
    if (activeMuscle === 'All') return dayPlan.exercises;

    return dayPlan.exercises.filter((exercise) =>
      exercise.muscles
        .split(',')
        .map((muscle) => muscle.trim().toLowerCase())
        .includes(activeMuscle.toLowerCase()),
    );
  }, [activeMuscle, dayPlan.exercises]);

  const addExercise = (event) => {
    event.preventDefault();
    const name = exerciseInput.trim();
    if (!name) return;
    const muscleGroup =
      exerciseMuscles.trim() ||
      (activeMuscle !== 'All' ? activeMuscle : muscleGroups[0]) ||
      'General';

    updateDay(activeDay, (current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        {
          id: makeId(),
          name,
          muscles: muscleGroup,
          sessions: [],
        },
      ],
    }));
    setExerciseInput('');
    setExerciseMuscles('');
  };

  const removeExercise = (exerciseId) => {
    updateDay(activeDay, (current) => ({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId),
    }));
  };

  const addSession = (exerciseId) => {
    updateDay(activeDay, (current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sessions: [
                {
                  id: makeId(),
                  date: new Date().toISOString().slice(0, 10),
                  sets: [{ id: makeId(), weight: '', reps: '' }],
                },
                ...exercise.sessions,
              ],
            }
          : exercise,
      ),
    }));
  };

  const removeSession = (exerciseId, sessionId) => {
    updateDay(activeDay, (current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sessions: exercise.sessions.filter((session) => session.id !== sessionId),
            }
          : exercise,
      ),
    }));
  };

  const updateSessionDate = (exerciseId, sessionId, date) => {
    updateDay(activeDay, (current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sessions: exercise.sessions.map((session) =>
                session.id === sessionId ? { ...session, date } : session,
              ),
            }
          : exercise,
      ),
    }));
  };

  const addSet = (exerciseId, sessionId) => {
    updateDay(activeDay, (current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sessions: exercise.sessions.map((session) =>
                session.id === sessionId
                  ? { ...session, sets: [...session.sets, { id: makeId(), weight: '', reps: '' }] }
                  : session,
              ),
            }
          : exercise,
      ),
    }));
  };

  const removeSet = (exerciseId, sessionId, setId) => {
    updateDay(activeDay, (current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sessions: exercise.sessions.map((session) =>
                session.id === sessionId
                  ? { ...session, sets: session.sets.filter((set) => set.id !== setId) }
                  : session,
              ),
            }
          : exercise,
      ),
    }));
  };

  const updateSet = (exerciseId, sessionId, setId, field, value) => {
    updateDay(activeDay, (current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sessions: exercise.sessions.map((session) =>
                session.id === sessionId
                  ? {
                      ...session,
                      sets: session.sets.map((set) => (set.id === setId ? { ...set, [field]: value } : set)),
                    }
                  : session,
              ),
            }
          : exercise,
      ),
    }));
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Weekly Lift Tracker</p>
          <h1>Plan each training day and log every working set.</h1>
          <p className="hero-copy">
            Add muscles, exercises, sessions, weight, reps, and sets for all seven days. Your progress syncs through
            the shared server and is ready for a cloud database.
          </p>
        </div>
        <div className="stat-grid" aria-label="Workout stats">
          <Stat icon={<Dumbbell />} label="Exercises" value={stats.exercises} />
          <Stat icon={<CalendarDays />} label="Sessions" value={stats.sessions} />
          <Stat icon={<Layers3 />} label="Sets" value={stats.sets} />
          <Stat icon={<Activity />} label="Volume" value={stats.volume.toLocaleString()} />
        </div>
      </section>

      <section className="workspace">
        <DayPicker activeDay={activeDay} plan={plan} setActiveDay={setActiveDay} />

        <section className="day-workspace">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Training day</p>
              <h2>{activeDay}</h2>
            </div>
            <span className={`save-pill ${saveState}`}>
              <Save size={15} />
              {saveState === 'loading'
                ? 'Loading'
                : saveState === 'saving'
                  ? 'Saving'
                  : saveState === 'offline'
                    ? 'Server offline'
                    : 'Synced'}
            </span>
          </div>

          <WorkoutBuilder
            activeMuscle={activeMuscle}
            addExercise={addExercise}
            addMuscle={addMuscle}
            dayPlan={normalizedDayPlan}
            exerciseInput={exerciseInput}
            exerciseMuscles={exerciseMuscles}
            muscleInput={muscleInput}
            removeMuscle={removeMuscle}
            setExerciseInput={setExerciseInput}
            setExerciseMuscles={setExerciseMuscles}
            setMuscleInput={setMuscleInput}
          />

          <MuscleTabs activeMuscle={activeMuscle} muscles={muscleGroups} setActiveMuscle={setActiveMuscle} />

          <div className="exercise-list">
            {filteredExercises.length ? (
              filteredExercises.map((exercise) => (
                <ExerciseCard
                  addSession={addSession}
                  addSet={addSet}
                  exercise={exercise}
                  key={exercise.id}
                  removeExercise={removeExercise}
                  removeSession={removeSession}
                  removeSet={removeSet}
                  updateSessionDate={updateSessionDate}
                  updateSet={updateSet}
                />
              ))
            ) : (
              <div className="empty-state">
                <Dumbbell size={36} />
                <h3>{activeMuscle === 'All' ? `No exercises for ${activeDay}` : `No ${activeMuscle} exercises yet`}</h3>
                <p>
                  {muscleGroups.length
                    ? 'Add an exercise for this muscle group and start logging sessions.'
                    : 'Add muscles first, then add your exercises and start logging sessions.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
