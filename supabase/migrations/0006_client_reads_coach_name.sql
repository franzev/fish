-- Three things in one migration (Phase 3 Plan 1):
-- (1) add + backfill an email column on profiles (D-13's coach-list requirement),
-- (2) extend handle_new_user() so email is populated going forward,
-- (3) add the reverse-read RLS allowance: a client can read their own coach's row (D-16).

-- (1) profiles has no email column today (0001_profiles.sql) -- email lives only on
-- auth.users. The existing "grant select, update on public.profiles to authenticated"
-- (0001 line 19) already covers this new column; no new grant needed.
alter table public.profiles add column email text not null default '';

-- (2) Extend the DB-01-hardened trigger to also copy new.email. All four hardening
-- elements from 0002 stay intact (security definer, search_path='', coalesce, on
-- conflict do nothing) -- only the column list and values change. Because 0002 already
-- ran against the live DB, this create-or-replace is what actually updates the live
-- function; editing 0002's file alone only takes effect on a fresh `db reset`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name, email)
  values (
    new.id,
    'client', -- AUTH-01/D-04/DB-04: signup ALWAYS creates a client, never trust metadata for role
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill existing rows (the three already-seeded accounts) whose email was set to the
-- column default '' before this migration ran.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email = '';

-- (3) Reverse-read helper, mirroring private.is_coach_of() (0004_rls_helpers.sql) exactly
-- but in reverse -- same recursion-safety discipline (security definer, stable,
-- search_path='', never bare-SELECT the profiles table this policy protects).
--
-- Deliberately omits is_coach_of()'s extra "and (select role ...) = 'coach'" caller-role
-- check: the enforce_coach_client_roles trigger (0003_coach_clients.sql) already
-- guarantees coach_clients.client_id only ever references a client-role profile, so the
-- caller being the referenced client_id is sufficient (RESEARCH.md Assumption A3 flags
-- this as a review checkpoint, not a bug -- do not add the redundant clause).
create or replace function private.is_client_of(coach_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = coach_uuid
        and cc.client_id = (select auth.uid())
    );
$$;

-- profiles: a client can read their own assigned coach's row (D-16).
create policy "client reads own coach"
  on public.profiles
  for select
  to authenticated
  using (private.is_client_of(id));
