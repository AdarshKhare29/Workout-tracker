import { createServer } from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

function loadEnvFile() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = valueParts.join('=').trim();
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 5174);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_DIR = join(ROOT, 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const PLANS_DIR = join(DATA_DIR, 'plans');
const DIST_DIR = join(ROOT, '..', 'frontend', 'dist');
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const isCloudSyncEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const jsonHeaders = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const makeId = () => randomUUID();
const makeToken = () => randomBytes(32).toString('hex');

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

const hashPassword = (password, salt = randomBytes(16).toString('hex')) => ({
  salt,
  passwordHash: scryptSync(password, salt, 64).toString('hex'),
});

const normalizeCloudUser = (user) =>
  user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.password_hash,
        salt: user.salt,
        createdAt: user.created_at,
      }
    : null;

const verifyPassword = (password, user) => {
  const candidate = scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.passwordHash, 'hex');
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
};

const splitMuscleList = (muscles = []) =>
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

const emptyPlan = () =>
  DAYS.reduce((plan, day) => {
    plan[day] = { muscles: [], exercises: [] };
    return plan;
  }, {});

const defaultPlan = () => ({
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

const normalizePlan = (plan) => {
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

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function ensureUsersFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await stat(USERS_FILE);
  } catch {
    await writeFile(USERS_FILE, JSON.stringify({ users: [], sessions: [] }, null, 2));
  }
}

async function readAuthStore() {
  await ensureUsersFile();
  const contents = await readFile(USERS_FILE, 'utf8');
  const store = JSON.parse(contents);

  return {
    users: Array.isArray(store.users) ? store.users : [],
    sessions: Array.isArray(store.sessions) ? store.sessions : [],
  };
}

async function saveAuthStore(store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    USERS_FILE,
    JSON.stringify(
      {
        users: Array.isArray(store.users) ? store.users : [],
        sessions: Array.isArray(store.sessions) ? store.sessions : [],
      },
      null,
      2,
    ),
  );
}

async function findUserByEmail(email) {
  if (isCloudSyncEnabled) return findCloudUserByEmail(email);

  const store = await readAuthStore();
  return store.users.find((item) => item.email === email) || null;
}

async function createUser({ name, email, password }) {
  const passwordFields = hashPassword(password);
  const user = {
    id: makeId(),
    name,
    email,
    ...passwordFields,
    createdAt: new Date().toISOString(),
  };

  if (isCloudSyncEnabled) return createCloudUser(user);

  const store = await readAuthStore();
  store.users.push(user);
  await saveAuthStore(store);
  return user;
}

async function createSession(userId) {
  if (isCloudSyncEnabled) return createCloudSession(userId);

  const store = await readAuthStore();
  const token = makeToken();

  store.sessions = [
    ...store.sessions.filter((session) => session.userId !== userId),
    {
      token,
      userId,
      createdAt: new Date().toISOString(),
    },
  ];

  await saveAuthStore(store);
  return token;
}

async function deleteSession(token) {
  if (isCloudSyncEnabled) {
    await deleteCloudSession(token);
    return;
  }

  const store = await readAuthStore();
  store.sessions = store.sessions.filter((session) => session.token !== token);
  await saveAuthStore(store);
}

function getBearerToken(request) {
  const header = request.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

async function getAuthenticatedUser(request) {
  const token = getBearerToken(request);
  if (!token) return null;

  if (isCloudSyncEnabled) return getCloudAuthenticatedUser(token);

  const store = await readAuthStore();
  const session = store.sessions.find((item) => item.token === token);
  if (!session) return null;

  const user = store.users.find((item) => item.id === session.userId);
  return user ? { token, user } : null;
}

async function findCloudUserByEmail(email) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/app_users?email=eq.${encodeURIComponent(email)}&select=*`,
    { headers: getSupabaseHeaders() },
  );

  if (!response.ok) {
    throw new Error(`Supabase user lookup failed with status ${response.status}.`);
  }

  const rows = await response.json();
  return normalizeCloudUser(rows[0]);
}

async function createCloudUser(user) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_users`, {
    body: JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash,
      salt: user.salt,
      created_at: user.createdAt,
    }),
    headers: getSupabaseHeaders(),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Supabase user create failed with status ${response.status}.`);
  }

  const rows = await response.json();
  return normalizeCloudUser(rows[0]);
}

async function createCloudSession(userId) {
  const token = makeToken();
  const deleteResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/app_sessions?user_id=eq.${encodeURIComponent(userId)}`,
    {
      headers: getSupabaseHeaders(),
      method: 'DELETE',
    },
  );

  if (!deleteResponse.ok) {
    throw new Error(`Supabase session cleanup failed with status ${deleteResponse.status}.`);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_sessions`, {
    body: JSON.stringify({
      token,
      user_id: userId,
      created_at: new Date().toISOString(),
    }),
    headers: getSupabaseHeaders(),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Supabase session create failed with status ${response.status}.`);
  }

  return token;
}

async function deleteCloudSession(token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_sessions?token=eq.${encodeURIComponent(token)}`, {
    headers: getSupabaseHeaders(),
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Supabase session delete failed with status ${response.status}.`);
  }
}

async function getCloudAuthenticatedUser(token) {
  const sessionResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/app_sessions?token=eq.${encodeURIComponent(token)}&select=user_id`,
    { headers: getSupabaseHeaders() },
  );

  if (!sessionResponse.ok) {
    throw new Error(`Supabase session lookup failed with status ${sessionResponse.status}.`);
  }

  const sessions = await sessionResponse.json();
  const userId = sessions[0]?.user_id;
  if (!userId) return null;

  const userResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/app_users?id=eq.${encodeURIComponent(userId)}&select=*`,
    { headers: getSupabaseHeaders() },
  );

  if (!userResponse.ok) {
    throw new Error(`Supabase authenticated user lookup failed with status ${userResponse.status}.`);
  }

  const users = await userResponse.json();
  const user = normalizeCloudUser(users[0]);
  return user ? { token, user } : null;
}

async function readPlan(userId) {
  if (isCloudSyncEnabled) return readCloudPlan(userId);

  await mkdir(PLANS_DIR, { recursive: true });
  const userPlanFile = join(PLANS_DIR, `${userId}.json`);

  try {
    const contents = await readFile(userPlanFile, 'utf8');
    return normalizePlan(JSON.parse(contents));
  } catch {
    const seededPlan = defaultPlan();
    await writeFile(userPlanFile, JSON.stringify(seededPlan, null, 2));
    return normalizePlan(seededPlan);
  }
}

async function savePlan(userId, plan) {
  if (isCloudSyncEnabled) {
    await saveCloudPlan(userId, plan);
    return;
  }

  await mkdir(PLANS_DIR, { recursive: true });
  await writeFile(join(PLANS_DIR, `${userId}.json`), JSON.stringify(normalizePlan(plan), null, 2));
}

async function readCloudPlan(userId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/workout_plans?id=eq.${encodeURIComponent(userId)}&select=plan`,
    { headers: getSupabaseHeaders() },
  );

  if (!response.ok) {
    throw new Error(`Supabase read failed with status ${response.status}.`);
  }

  const rows = await response.json();
  if (rows[0]?.plan) return normalizePlan(rows[0].plan);

  const seededPlan = defaultPlan();
  await saveCloudPlan(userId, seededPlan);
  return seededPlan;
}

async function saveCloudPlan(userId, plan) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/workout_plans`, {
    body: JSON.stringify({
      id: userId,
      plan: normalizePlan(plan),
      updated_at: new Date().toISOString(),
    }),
    headers: {
      ...getSupabaseHeaders(),
      Prefer: 'resolution=merge-duplicates',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Supabase save failed with status ${response.status}.`);
  }
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(response, status, payload) {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(payload));
}

async function handleApi(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  if (request.url === '/api/auth/signup' && request.method === 'POST') {
    const body = JSON.parse(await readRequestBody(request));
    const email = normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      sendJson(response, 400, { error: 'Name, valid email, and 6+ character password are required.' });
      return;
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      sendJson(response, 409, { error: 'An account with this email already exists.' });
      return;
    }

    const user = await createUser({
      name,
      email,
      password,
    });
    const token = await createSession(user.id);
    sendJson(response, 201, { token, user: publicUser(user) });
    return;
  }

  if (request.url === '/api/auth/login' && request.method === 'POST') {
    const body = JSON.parse(await readRequestBody(request));
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const user = await findUserByEmail(email);

    if (!user || !verifyPassword(password, user)) {
      sendJson(response, 401, { error: 'Invalid email or password.' });
      return;
    }

    const token = await createSession(user.id);
    sendJson(response, 200, { token, user: publicUser(user) });
    return;
  }

  if (request.url === '/api/auth/me' && request.method === 'GET') {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      sendJson(response, 401, { error: 'Not authenticated.' });
      return;
    }

    sendJson(response, 200, { user: publicUser(auth.user) });
    return;
  }

  if (request.url === '/api/auth/logout' && request.method === 'POST') {
    const token = getBearerToken(request);

    if (token) {
      await deleteSession(token);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url === '/api/plan' && request.method === 'GET') {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      sendJson(response, 401, { error: 'Not authenticated.' });
      return;
    }

    sendJson(response, 200, { plan: await readPlan(auth.user.id) });
    return;
  }

  if (request.url === '/api/plan' && request.method === 'PUT') {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      sendJson(response, 401, { error: 'Not authenticated.' });
      return;
    }

    try {
      const body = JSON.parse(await readRequestBody(request));
      await savePlan(auth.user.id, body.plan);
      sendJson(response, 200, { ok: true });
    } catch {
      sendJson(response, 400, { error: 'Invalid workout plan payload.' });
    }
    return;
  }

  sendJson(response, 404, { error: 'API route not found.' });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(DIST_DIR, requestedPath));

  if (!filePath.startsWith(normalize(DIST_DIR))) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    });
    response.end(file);
  } catch {
    const fallback = await readFile(join(DIST_DIR, 'index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(fallback);
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/api/')) {
      await handleApi(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Unexpected server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`Workout tracker server running at http://localhost:${PORT}`);
  console.log(`Storage mode: ${isCloudSyncEnabled ? 'Supabase cloud sync' : 'local JSON file'}`);
});
