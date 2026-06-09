# Weekly Lift Tracker

Responsive React workout tracker for planning all seven days of the week, adding muscles and exercises, and logging sessions with sets, reps, and weight.

## Run Locally

```bash
npm install
npm run build
npm start
```

Open `http://localhost:5174`.

## True Cross-Device Sync

For true sync across devices, deploy this app/server and connect it to Supabase.

1. Create a Supabase project.
2. Run the SQL in `backend/supabase-schema.sql`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Start the server with `npm start`.

When Supabase variables are present, the server stores users, sessions, and workout plans in Supabase. Without them, it uses `backend/data/users.json` and per-user JSON files in `backend/data/plans/` for local development.

User accounts are created through the app's signup screen. In cloud mode, accounts survive redeploys because auth data lives in the `app_users` and `app_sessions` tables, while plans live in `workout_plans` by user id.

## Project Structure

```txt
frontend/                   Vite React app
frontend/src/api.js         API client for the React app
frontend/src/components/    Reusable UI components
frontend/src/hooks/         Loading, saving, and sync status
backend/server.mjs          API server, static hosting, local/Supabase storage
backend/data/               Local JSON fallback data
```
