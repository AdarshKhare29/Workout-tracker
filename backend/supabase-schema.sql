create table if not exists public.app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id text primary key, -- stores the authenticated app user id
  plan jsonb not null,
  updated_at timestamptz not null default now()
);
