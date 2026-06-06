import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, CalendarDays, Dumbbell, Layers3, LogOut, Save, UserCircle } from 'lucide-react';
import { fetchCurrentUser, logoutUser } from './api';
import { AuthScreen } from './components/AuthScreen';
import { DayPicker } from './components/DayPicker';
import { ExerciseCard } from './components/ExerciseCard';
import { MuscleTabs } from './components/MuscleTabs';
import { Stat } from './components/Stat';
import { WorkoutBuilder } from './components/WorkoutBuilder';
import { splitMuscleList } from './data/workoutPlan';
import { useWorkoutPlan } from './hooks/useWorkoutPlan';
import { makeId } from './utils/ids';
import './styles.css';

const AUTH_TOKEN_KEY = 'weekly-lift-auth-token';

function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem(AUTH_TOKEN_KEY) || '');
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState(token ? 'loading' : 'signed-out');
  const { plan, saveState, setPlan } = useWorkoutPlan(token);
  const [activeDay, setActiveDay] = useState('Monday');
  const [muscleInput, setMuscleInput] = useState('');
  const [exerciseInput, setExerciseInput] = useState('');
  const [exerciseMuscles, setExerciseMuscles] = useState('');
  const [activeMuscle, setActiveMuscle] = useState('All');
  const [deletePrompt, setDeletePrompt] = useState(null);

  const dayPlan = plan[activeDay];
  const muscleGroups = useMemo(() => splitMuscleList(dayPlan.muscles), [dayPlan.muscles]);
  const normalizedDayPlan = useMemo(() => ({ ...dayPlan, muscles: muscleGroups }), [dayPlan, muscleGroups]);

  useEffect(() => {
    let ignore = false;

    async function restoreUser() {
      if (!token) {
        setUser(null);
        setAuthState('signed-out');
        return;
      }

      try {
        const data = await fetchCurrentUser(token);

        if (!ignore) {
          setUser(data.user);
          setAuthState('signed-in');
        }
      } catch {
        if (!ignore) {
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
          setToken('');
          setUser(null);
          setAuthState('signed-out');
        }
      }
    }

    restoreUser();

    return () => {
      ignore = true;
    };
  }, [token]);

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

  const requestDelete = (prompt) => {
    setDeletePrompt(prompt);
  };

  const closeDeletePrompt = () => {
    setDeletePrompt(null);
  };

  const confirmDelete = () => {
    deletePrompt?.onConfirm();
    closeDeletePrompt();
  };

  const removeMuscle = (muscle) => {
    updateDay(activeDay, (current) => ({
      ...current,
      muscles: splitMuscleList(current.muscles).filter((item) => item !== muscle),
    }));
  };

  const confirmRemoveMuscle = (muscle) => {
    requestDelete({
      title: 'Delete muscle?',
      message: `Remove ${muscle} from ${activeDay}? Exercises already linked to this muscle will stay.`,
      onConfirm: () => removeMuscle(muscle),
    });
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

  const confirmRemoveExercise = (exerciseId) => {
    const exercise = dayPlan.exercises.find((item) => item.id === exerciseId);

    requestDelete({
      title: 'Delete exercise?',
      message: `Delete ${exercise?.name || 'this exercise'} and all of its sessions from ${activeDay}?`,
      onConfirm: () => removeExercise(exerciseId),
    });
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

  const confirmRemoveSession = (exerciseId, sessionId) => {
    const exercise = dayPlan.exercises.find((item) => item.id === exerciseId);
    const session = exercise?.sessions.find((item) => item.id === sessionId);

    requestDelete({
      title: 'Delete session?',
      message: `Delete ${session?.date || 'this session'} from ${exercise?.name || 'this exercise'}?`,
      onConfirm: () => removeSession(exerciseId, sessionId),
    });
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

  const confirmRemoveSet = (exerciseId, sessionId, setId, setNumber) => {
    requestDelete({
      title: 'Delete set?',
      message: `Delete set ${setNumber || ''}? This cannot be undone.`,
      onConfirm: () => removeSet(exerciseId, sessionId, setId),
    });
  };

  const handleAuthenticated = ({ token: nextToken, user: nextUser }) => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setAuthState('signed-in');
  };

  const handleLogout = async () => {
    const currentToken = token;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken('');
    setUser(null);
    setAuthState('signed-out');
    setDeletePrompt(null);
    await logoutUser(currentToken).catch(() => {});
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

  if (authState === 'loading') {
    return (
      <main className="auth-shell">
        <section className="auth-panel loading-panel">
          <div className="auth-brand">
            <span>
              <Dumbbell size={26} />
            </span>
            <div>
              <p className="eyebrow">Weekly Lift Tracker</p>
              <h1>Loading your profile</h1>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Weekly Lift Tracker</p>
          <h1>Plan each training day and log every working set.</h1>
          <p className="hero-copy">
            Add muscles, exercises, sessions, weight, reps, and sets for all seven days. Your progress syncs through
            your profile and is ready for a cloud database.
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
            <div className="account-actions">
              <span className="profile-pill">
                <UserCircle size={16} />
                {user.name}
              </span>
              <button className="icon-button" onClick={handleLogout} type="button" aria-label="Logout">
                <LogOut size={17} />
              </button>
            </div>
          </div>

          <WorkoutBuilder
            activeMuscle={activeMuscle}
            addExercise={addExercise}
            addMuscle={addMuscle}
            dayPlan={normalizedDayPlan}
            exerciseInput={exerciseInput}
            exerciseMuscles={exerciseMuscles}
            muscleInput={muscleInput}
            removeMuscle={confirmRemoveMuscle}
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
                  removeExercise={confirmRemoveExercise}
                  removeSession={confirmRemoveSession}
                  removeSet={confirmRemoveSet}
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

      {deletePrompt ? (
        <div aria-modal="true" className="modal-backdrop" role="dialog">
          <div className="confirm-modal">
            <div className="modal-icon">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3>{deletePrompt.title}</h3>
              <p>{deletePrompt.message}</p>
            </div>
            <div className="modal-actions">
              <button className="text-button" onClick={closeDeletePrompt} type="button">
                Cancel
              </button>
              <button className="text-button danger-fill" onClick={confirmDelete} type="button">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
