-- Keep standard APNs and PushKit registrations side by side for one install.
-- Tokens remain command-managed; clients never receive direct table access.

alter table public.push_devices
  add column if not exists push_kind text not null default 'standard';

alter table public.push_devices
  drop constraint if exists push_devices_push_kind_check;

alter table public.push_devices
  add constraint push_devices_push_kind_check
  check (push_kind in ('standard', 'voip'));

alter table public.push_devices
  drop constraint if exists push_devices_user_id_installation_id_key;

alter table public.push_devices
  add constraint push_devices_user_installation_kind_key
  unique (user_id, installation_id, push_kind);

create or replace function public.register_push_device(
  p_installation_id uuid,
  p_provider_installation_id text,
  p_platform text,
  p_app_version text
)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_provider_installation_id text := btrim(p_provider_installation_id);
  v_version text := btrim(p_app_version);
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_installation_id is null
    or char_length(v_provider_installation_id) not between 8 and 256
    or p_platform not in ('android', 'ios')
    or char_length(v_version) not between 1 and 64 then
    raise exception 'invalid push device';
  end if;
  if exists (
    select 1 from public.push_devices
    where revoked_at is null
      and push_kind = 'standard'
      and (
        provider_installation_id = v_provider_installation_id
        or installation_id = p_installation_id
      )
      and user_id <> v_user_id
  ) then
    raise exception 'push device belongs to another account';
  end if;

  update public.push_devices
  set revoked_at = now(), updated_at = now()
  where revoked_at is null
    and push_kind = 'standard'
    and (
      provider_installation_id = v_provider_installation_id
      or (installation_id = p_installation_id and user_id = v_user_id)
    )
    and not (user_id = v_user_id and installation_id = p_installation_id);

  insert into public.push_devices (
    user_id,
    installation_id,
    provider_installation_id,
    platform,
    push_kind,
    app_version,
    last_seen_at,
    revoked_at,
    updated_at
  ) values (
    v_user_id,
    p_installation_id,
    v_provider_installation_id,
    p_platform,
    'standard',
    v_version,
    now(),
    null,
    now()
  )
  on conflict (user_id, installation_id, push_kind) do update
  set provider_installation_id = excluded.provider_installation_id,
      platform = excluded.platform,
      app_version = excluded.app_version,
      last_seen_at = excluded.last_seen_at,
      revoked_at = null,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.register_voip_push_device(
  p_installation_id uuid,
  p_provider_installation_id text,
  p_app_version text
)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_provider_installation_id text := btrim(p_provider_installation_id);
  v_version text := btrim(p_app_version);
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_installation_id is null
    or char_length(v_provider_installation_id) not between 8 and 256
    or char_length(v_version) not between 1 and 64 then
    raise exception 'invalid voip push device';
  end if;
  if exists (
    select 1 from public.push_devices
    where revoked_at is null
      and push_kind = 'voip'
      and (
        provider_installation_id = v_provider_installation_id
        or installation_id = p_installation_id
      )
      and user_id <> v_user_id
  ) then
    raise exception 'push device belongs to another account';
  end if;

  update public.push_devices
  set revoked_at = now(), updated_at = now()
  where revoked_at is null
    and push_kind = 'voip'
    and (
      provider_installation_id = v_provider_installation_id
      or (installation_id = p_installation_id and user_id = v_user_id)
    )
    and not (user_id = v_user_id and installation_id = p_installation_id);

  insert into public.push_devices (
    user_id,
    installation_id,
    provider_installation_id,
    platform,
    push_kind,
    app_version,
    last_seen_at,
    revoked_at,
    updated_at
  ) values (
    v_user_id,
    p_installation_id,
    v_provider_installation_id,
    'ios',
    'voip',
    v_version,
    now(),
    null,
    now()
  )
  on conflict (user_id, installation_id, push_kind) do update
  set provider_installation_id = excluded.provider_installation_id,
      platform = excluded.platform,
      app_version = excluded.app_version,
      last_seen_at = excluded.last_seen_at,
      revoked_at = null,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.unregister_voip_push_device(p_installation_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  update public.push_devices
  set revoked_at = now(), updated_at = now()
  where user_id = v_user_id
    and installation_id = p_installation_id
    and push_kind = 'voip'
    and revoked_at is null;
end;
$$;

revoke execute on function public.register_voip_push_device(uuid, text, text) from public;
revoke execute on function public.unregister_voip_push_device(uuid) from public;
grant execute on function public.register_voip_push_device(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.unregister_voip_push_device(uuid)
  to authenticated, service_role;

-- Dispatchers use the service role to select active tokens and revoke stale
-- ones; clients still have no table privileges.
grant select, update on table public.push_devices to service_role;
