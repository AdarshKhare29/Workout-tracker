import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
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
const SUPABASE_PLAN_ID = process.env.SUPABASE_PLAN_ID || 'default';
const DATA_DIR = join(ROOT, 'data');
const DATA_FILE = join(DATA_DIR, 'workout-plan.json');
const DIST_DIR = join(ROOT, '..', 'frontend', 'dist');
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const isCloudSyncEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const jsonHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
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

async function ensurePlanFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await stat(DATA_FILE);
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultPlan(), null, 2));
  }
}

async function readPlan() {
  if (isCloudSyncEnabled) return readCloudPlan();

  await ensurePlanFile();
  const contents = await readFile(DATA_FILE, 'utf8');
  return normalizePlan(JSON.parse(contents));
}

async function savePlan(plan) {
  if (isCloudSyncEnabled) {
    await saveCloudPlan(plan);
    return;
  }

  await ensurePlanFile();
  await writeFile(DATA_FILE, JSON.stringify(normalizePlan(plan), null, 2));
}

async function readCloudPlan() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/workout_plans?id=eq.${encodeURIComponent(SUPABASE_PLAN_ID)}&select=plan`,
    { headers: getSupabaseHeaders() },
  );

  if (!response.ok) {
    throw new Error(`Supabase read failed with status ${response.status}.`);
  }

  const rows = await response.json();
  if (rows[0]?.plan) return normalizePlan(rows[0].plan);

  const seededPlan = defaultPlan();
  await saveCloudPlan(seededPlan);
  return seededPlan;
}

async function saveCloudPlan(plan) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/workout_plans`, {
    body: JSON.stringify({
      id: SUPABASE_PLAN_ID,
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

  if (request.url === '/api/plan' && request.method === 'GET') {
    sendJson(response, 200, { plan: await readPlan() });
    return;
  }

  if (request.url === '/api/plan' && request.method === 'PUT') {
    try {
      const body = JSON.parse(await readRequestBody(request));
      await savePlan(body.plan);
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
