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

-- Table-level grants (Postgres privilege layer, evaluated BEFORE row level security):
-- a fresh table has no privileges for authenticated/service_role until granted. Without
-- these, every policy above is unreachable -- PostgREST/the Supabase client would get
-- "permission denied for table profiles" regardless of RLS. No policy targets `anon`
-- (signed-out users never read profiles), so no anon grant is added. service_role
-- bypasses RLS row-filtering but still needs base table privileges.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Self-read only in this migration. The coach-read policy needs a private RLS helper that
-- depends on a table created two migrations later (0003) -- that helper is added in 0004
-- to avoid forward-referencing a relation that doesn't exist yet (review HIGH concern).
create policy "client reads own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));
