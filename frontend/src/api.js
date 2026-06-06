const API_URL = '/api/plan';

export async function fetchWorkoutPlan() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error('Could not load workout plan.');
  const data = await response.json();
  return data.plan;
}

export async function saveWorkoutPlan(plan) {
  const response = await fetch(API_URL, {
    body: JSON.stringify({ plan }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });

  if (!response.ok) throw new Error('Could not save workout plan.');
}
