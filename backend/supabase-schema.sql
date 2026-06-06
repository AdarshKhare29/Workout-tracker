create table if not exists public.workout_plans (
  id text primary key, -- stores the authenticated app user id
  plan jsonb not null,
  updated_at timestamptz not null default now()
);
