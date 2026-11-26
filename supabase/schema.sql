-- Focus Flow Supabase PostgreSQL Schema
-- Run this SQL in your Supabase project SQL Editor:
-- https://supabase.com/dashboard/project/exsuwvqxvxihrkzuahmd/sql/new

create table if not exists public.ff_accounts (
  id text primary key,
  email text unique not null,
  full_name text not null,
  role_title text not null default 'Personal Workspace',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.ff_categories (
  id text primary key,
  workspace_id text not null default 'default',
  name text not null,
  color text not null,
  icon text not null,
  is_default boolean not null default false
);

create table if not exists public.ff_projects (
  id text primary key,
  workspace_id text not null default 'default',
  name text not null,
  description text not null default '',
  deadline text not null default '',
  color text not null default '#5E6AD2',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.ff_tasks (
  id text primary key,
  workspace_id text not null default 'default',
  title text not null,
  description text not null default '',
  due_date text not null default '',
  due_time text not null default '',
  priority text not null default 'medium',
  category_id text not null default 'cat-personal',
  project_id text,
  status text not null default 'todo',
  subtasks jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  estimated_minutes integer not null default 30,
  recurring text not null default 'none',
  notes text not null default '',
  sort_order bigint not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ff_habits (
  id text primary key,
  workspace_id text not null default 'default',
  name text not null,
  description text not null default '',
  color text not null default '#0D9488',
  icon text not null default 'Flame',
  schedule_type text not null default 'daily',
  target_days jsonb not null default '[0,1,2,3,4,5,6]'::jsonb,
  completed_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ff_focus_sessions (
  id text primary key,
  workspace_id text not null default 'default',
  task_id text,
  task_title text,
  mode text not null default 'focus',
  duration_minutes integer not null default 25,
  completed_at timestamptz not null default now(),
  session_date text not null
);

create table if not exists public.ff_preferences (
  workspace_id text primary key,
  preferences jsonb not null default '{}'::jsonb,
  focus_timer jsonb not null default '{}'::jsonb,
  dismissed_notification_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_ff_accounts_email on public.ff_accounts (email);
create index if not exists idx_ff_tasks_workspace on public.ff_tasks (workspace_id);
create index if not exists idx_ff_projects_workspace on public.ff_projects (workspace_id);
create index if not exists idx_ff_habits_workspace on public.ff_habits (workspace_id);
create index if not exists idx_ff_focus_workspace on public.ff_focus_sessions (workspace_id);

-- Row Level Security (server uses SUPABASE_SERVICE_ROLE_KEY or authenticated user JWT)
alter table public.ff_accounts enable row level security;
alter table public.ff_categories enable row level security;
alter table public.ff_projects enable row level security;
alter table public.ff_tasks enable row level security;
alter table public.ff_habits enable row level security;
alter table public.ff_focus_sessions enable row level security;
alter table public.ff_preferences enable row level security;

drop policy if exists "ff_accounts_own_all" on public.ff_accounts;
create policy "ff_accounts_own_all" on public.ff_accounts
  for all to authenticated
  using (auth.uid()::text = id)
  with check (auth.uid()::text = id);

drop policy if exists "ff_categories_own_all" on public.ff_categories;
create policy "ff_categories_own_all" on public.ff_categories
  for all to authenticated
  using (auth.uid()::text = workspace_id)
  with check (auth.uid()::text = workspace_id);

drop policy if exists "ff_projects_own_all" on public.ff_projects;
create policy "ff_projects_own_all" on public.ff_projects
  for all to authenticated
  using (auth.uid()::text = workspace_id)
  with check (auth.uid()::text = workspace_id);

drop policy if exists "ff_tasks_own_all" on public.ff_tasks;
create policy "ff_tasks_own_all" on public.ff_tasks
  for all to authenticated
  using (auth.uid()::text = workspace_id)
  with check (auth.uid()::text = workspace_id);

drop policy if exists "ff_habits_own_all" on public.ff_habits;
create policy "ff_habits_own_all" on public.ff_habits
  for all to authenticated
  using (auth.uid()::text = workspace_id)
  with check (auth.uid()::text = workspace_id);

drop policy if exists "ff_focus_sessions_own_all" on public.ff_focus_sessions;
create policy "ff_focus_sessions_own_all" on public.ff_focus_sessions
  for all to authenticated
  using (auth.uid()::text = workspace_id)
  with check (auth.uid()::text = workspace_id);

drop policy if exists "ff_preferences_own_all" on public.ff_preferences;
create policy "ff_preferences_own_all" on public.ff_preferences
  for all to authenticated
  using (auth.uid()::text = workspace_id)
  with check (auth.uid()::text = workspace_id);
