-- client_profiles: 1:1 with public.profiles, holding client-only data (D-01) — goal/role-context,
-- coach-owned level, accessibility prefs, consent metadata. PK references profiles(id), not
-- auth.users(id), because provisioning (below) fires AFTER the profile row exists.
--
-- This migration is the reused write-safety discipline the whole v1.1 milestone copies (D-08):
-- a column-scoped GRANT UPDATE (safe fields only, `level` never named) as freeze layer 1, plus a
-- BEFORE-UPDATE trigger mirroring 0005_role_guard.sql's shape as an independent freeze layer 2
-- (RESEARCH Pattern 1, live-verified: layer 1 rejects with 42501 before the trigger ever runs;
-- layer 2 independently rejects with P0001 even if a future migration accidentally widens the
-- grant). `role` remains protected by the existing 0005 trigger on profiles — this table only
-- adds the `level` freeze (D-04/D-08).
create table public.client_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  goal text not null default '', -- D-03: one freeform field, not two structured columns
  locale text,
  timezone text,
  level text, -- coach-owned, seed-set, protected (D-08) — nullable until seeded/set
  theme_pref text check (theme_pref in ('light', 'dark')), -- D-04/D-13: NULL = follow system
  text_size_pref text check (text_size_pref in ('default', 'large', 'larger')), -- D-13
  reduced_motion_pref boolean, -- D-04: NULL = follow system, non-null = explicit override
  consented boolean not null default false, -- D-12: consent as fields only
  consented_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_profiles enable row level security;

-- Table + column grants (Postgres privilege layer, evaluated BEFORE row level security) --
-- see 0001_profiles.sql for why these are required. SELECT is table-wide (RLS narrows rows);
-- UPDATE is column-scoped to the explicit safe list below. `level` is NEVER named in the
-- authenticated UPDATE grant -- this is freeze layer 1 (D-08).
grant select on public.client_profiles to authenticated;
grant update (
  goal, locale, timezone,
  theme_pref, text_size_pref, reduced_motion_pref,
  consented, consented_at, consent_version
) on public.client_profiles to authenticated;
grant select, insert, update, delete on public.client_profiles to service_role;

create policy "client reads own client_profile"
  on public.client_profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "client updates own safe fields"
  on public.client_profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Reuse 0004's private.is_coach_of helper verbatim -- do not redefine it (D-11).
create policy "coach reads assigned client's client_profile"
  on public.client_profiles
  for select
  to authenticated
  using (private.is_coach_of(id));

-- Freeze layer 2: mirrors 0005_role_guard.sql's prevent_role_self_escalation shape exactly.
-- Independent of the column grant above -- if `level` is ever accidentally granted to
-- authenticated in a future migration, this trigger still rejects the change (RESEARCH
-- Pattern 1, case 5, live-verified this session).
create or replace function public.prevent_level_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.level is distinct from old.level then
    raise exception 'level cannot be changed by this caller';
  end if;
  return new;
end;
$$;

create trigger prevent_level_change
  before update on public.client_profiles
  for each row
  when (auth.role() = 'authenticated') -- service_role (seed) bypasses this WHEN clause
  execute function public.prevent_level_self_escalation();

-- Auto-provision (D-02): a separate AFTER INSERT ON profiles trigger, NOT an edit to
-- handle_new_user (0002) -- that function is explicitly hardened and its own comment marks
-- all four hardening elements "mandatory, not a subset" (RESEARCH Pitfall 6). Every profile
-- insert already flows through the on_auth_user_created trigger (0002), so this trigger fires
-- in the same transaction and gives the identical "no client ever missing a row" guarantee
-- with zero edits to the auth-critical path (RESEARCH Pattern 3, Option B).
create or replace function public.provision_client_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'client' then
    insert into public.client_profiles (id) values (new.id)
    on conflict (id) do nothing; -- idempotent, mirrors handle_new_user's own idempotency
  end if;
  return new;
end;
$$;

create trigger provision_client_profile_trigger
  after insert on public.profiles
  for each row execute function public.provision_client_profile();
