-- profiles: one row per auth.users row, created by the handle_new_user trigger (0002).
-- Role storage lives here, never in auth.users' user_metadata (DB-04 / AUTH-01).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'coach')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Self-read only in this migration. The coach-read policy needs a private RLS helper that
-- depends on a table created two migrations later (0003) -- that helper is added in 0004
-- to avoid forward-referencing a relation that doesn't exist yet (review HIGH concern).
create policy "client reads own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));
