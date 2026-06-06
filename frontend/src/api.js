const API_URL = '/api/plan';
const AUTH_URL = '/api/auth';

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

async function readJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

export async function fetchWorkoutPlan(token) {
  const response = await fetch(API_URL, {
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error('Could not load workout plan.');
  const data = await response.json();
  return data.plan;
}

export async function saveWorkoutPlan(plan, token) {
  const response = await fetch(API_URL, {
    body: JSON.stringify({ plan }),
    headers: authHeaders(token),
    method: 'PUT',
  });

  if (!response.ok) throw new Error('Could not save workout plan.');
}

export async function signUpUser({ name, email, password }) {
  const response = await fetch(`${AUTH_URL}/signup`, {
    body: JSON.stringify({ name, email, password }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  return readJson(response, 'Could not create account.');
}

export async function loginUser({ email, password }) {
  const response = await fetch(`${AUTH_URL}/login`, {
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  return readJson(response, 'Could not log in.');
}

export async function fetchCurrentUser(token) {
  const response = await fetch(`${AUTH_URL}/me`, {
    headers: authHeaders(token),
  });

  return readJson(response, 'Could not load user.');
}

export async function logoutUser(token) {
  await fetch(`${AUTH_URL}/logout`, {
    headers: authHeaders(token),
    method: 'POST',
  });
}
