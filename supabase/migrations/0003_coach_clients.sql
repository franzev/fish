-- coach_clients: one-coach-per-client relationship (D-09). The UNIQUE on client_id IS the
-- enforcement -- D-12's "reassignment replaces" relies on there being exactly one live row
-- per client. Writes are service-role only (seed script bypasses RLS) -- no authenticated
-- INSERT/UPDATE policy is added anywhere in this phase.
create table public.coach_clients (
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade unique,
  assigned_at timestamptz not null default now(),
  primary key (coach_id, client_id)
);

alter table public.coach_clients enable row level security;

-- Table-level grants (Postgres privilege layer, evaluated BEFORE row level security) --
-- see 0001_profiles.sql for why these are required. Authenticated users only ever read
-- (writes are service-role only, per this file's own top comment).
grant select on public.coach_clients to authenticated;
grant select, insert, update, delete on public.coach_clients to service_role;

-- Role-integrity enforcement (review MEDIUM): a malformed row (wrong-role coach_id/client_id)
-- must never be able to exist, since the private RLS helper added in 0004 trusts
-- coach_clients membership.
create or replace function public.enforce_coach_client_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select role from public.profiles where id = new.coach_id) is distinct from 'coach' then
    raise exception 'coach_id must reference a profile with role = coach';
  end if;
  if (select role from public.profiles where id = new.client_id) is distinct from 'client' then
    raise exception 'client_id must reference a profile with role = client';
  end if;
  return new;
end;
$$;

create trigger enforce_coach_client_roles_trigger
  before insert or update on public.coach_clients
  for each row execute function public.enforce_coach_client_roles();

-- Client self-read only in this migration -- the coach-read policy needs the private RLS
-- helper, created in 0004 after this table exists.
create policy "client reads own coach assignment"
  on public.coach_clients
  for select
  to authenticated
  using (client_id = (select auth.uid()));
