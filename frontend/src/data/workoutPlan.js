export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const emptyPlan = () =>
  DAYS.reduce((plan, day) => {
    plan[day] = { muscles: [], exercises: [] };
    return plan;
  }, {});

export const splitMuscleList = (muscles = []) =>
  muscles
    .flatMap((muscle) => String(muscle).split(','))
    .map((muscle) => muscle.trim())
    .filter(Boolean)
    .filter((muscle, index, list) => list.findIndex((item) => item.toLowerCase() === muscle.toLowerCase()) === index);

const normalizeExercises = (exercises = []) =>
  (Array.isArray(exercises) ? exercises : []).map((exercise) => ({
    ...exercise,
    sessions: (Array.isArray(exercise.sessions) ? exercise.sessions : []).map((session) => ({
      ...session,
      sets: Array.isArray(session.sets) ? session.sets : [],
    })),
  }));

export const createDefaultPlan = (makeId) => ({
  ...emptyPlan(),
  Monday: {
    muscles: ['Back', 'Biceps'],
    exercises: [
      {
        id: makeId(),
        name: 'Lat Pulldown',
        muscles: 'Back',
        sessions: [
          {
            id: makeId(),
            date: new Date().toISOString().slice(0, 10),
            sets: [
              { id: makeId(), weight: 35, reps: 12 },
              { id: makeId(), weight: 40, reps: 10 },
            ],
          },
        ],
      },
      {
        id: makeId(),
        name: 'Dumbbell Curl',
        muscles: 'Biceps',
        sessions: [
          {
            id: makeId(),
            date: new Date().toISOString().slice(0, 10),
            sets: [{ id: makeId(), weight: 10, reps: 12 }],
          },
        ],
      },
    ],
  },
});

export const normalizePlan = (plan) => {
  const mergedPlan = { ...emptyPlan(), ...(plan || {}) };

  return DAYS.reduce((normalized, day) => {
    normalized[day] = {
      ...mergedPlan[day],
      muscles: splitMuscleList(mergedPlan[day].muscles),
      exercises: normalizeExercises(mergedPlan[day].exercises),
    };
    return normalized;
  }, {});
};
