create table if not exists public.workout_plans (
  id text primary key,
  plan jsonb not null,
  updated_at timestamptz not null default now()
);
