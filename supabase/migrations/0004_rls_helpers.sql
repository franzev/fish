-- Runs AFTER 0003, so public.coach_clients already exists -- this ordering is the fix for
-- the review's HIGH concern (no forward-referenced relation at creation time).
create schema if not exists private;

-- Recursion-safe helper (Pitfall 2): RLS policies must never bare-SELECT the table they
-- protect. This also verifies the caller's OWN role is coach (review MEDIUM) -- a
-- malformed coach_clients row alone is not enough to leak a profile; the caller must
-- genuinely be a coach.
create or replace function private.is_coach_of(client_uuid uuid)
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
      where cc.client_id = client_uuid
        and cc.coach_id = (select auth.uid())
    )
    and (select role from public.profiles where id = (select auth.uid())) = 'coach';
$$;

-- profiles: a coach can read their assigned clients' rows.
create policy "coach reads assigned clients"
  on public.profiles
  for select
  to authenticated
  using (private.is_coach_of(id));

-- profiles: authenticated users can update their own safe fields (display_name).
-- The role column is NOT protected by this policy -- it is protected by the 0005
-- role-escalation guard trigger. Without this UPDATE policy, an authenticated role-change
-- attempt would be blocked at the RLS layer before ever reaching the trigger, which would
-- make the DB-04 guard untestable (review MEDIUM).
create policy "user updates own profile safe fields"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- coach_clients: a coach can read their own assignments (client self-read already exists
-- from 0003). No authenticated INSERT/UPDATE policy -- writes are service-role only.
create policy "coach reads own assignments"
  on public.coach_clients
  for select
  to authenticated
  using (coach_id = (select auth.uid()));
