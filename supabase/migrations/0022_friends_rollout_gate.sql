-- Friends is coach-validated and must fail closed. The database flag is the
-- authoritative boundary for every direct RPC as well as Edge Function calls.
-- Deployment tooling may enable it only after the matching web and function
-- environment flags have been deliberately configured.

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

grant select, insert, update, delete on public.feature_flags to service_role;

insert into public.feature_flags (key, enabled)
values ('friends', false);

create or replace function private.require_client_caller()
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_enabled boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'client' then
    raise exception 'friends not available';
  end if;

  select ff.enabled into v_enabled
  from public.feature_flags ff
  where ff.key = 'friends';

  if v_enabled is distinct from true then
    raise exception 'friends not available';
  end if;

  return v_user_id;
end;
$$;
