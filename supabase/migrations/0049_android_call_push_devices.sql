-- Android call push registrations are command-managed and never exposed through
-- direct table policies. Provider installation IDs are operational identifiers,
-- not profile data.

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  provider_installation_id text not null
    check (char_length(provider_installation_id) between 8 and 256),
  platform text not null check (platform in ('android')),
  app_version text not null check (char_length(app_version) between 1 and 64),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create unique index push_devices_active_provider_installation_key
  on public.push_devices (provider_installation_id)
  where revoked_at is null;

create index push_devices_active_user_idx
  on public.push_devices (user_id)
  where revoked_at is null;

alter table public.push_devices enable row level security;

create function public.register_push_device(
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
    or p_platform <> 'android'
    or char_length(v_version) not between 1 and 64 then
    raise exception 'invalid push device';
  end if;

  update public.push_devices
  set revoked_at = now(), updated_at = now()
  where revoked_at is null
    and (
      provider_installation_id = v_provider_installation_id
      or installation_id = p_installation_id
    )
    and not (user_id = v_user_id and installation_id = p_installation_id);

  insert into public.push_devices (
    user_id,
    installation_id,
    provider_installation_id,
    platform,
    app_version,
    last_seen_at,
    revoked_at,
    updated_at
  ) values (
    v_user_id,
    p_installation_id,
    v_provider_installation_id,
    p_platform,
    v_version,
    now(),
    null,
    now()
  )
  on conflict (user_id, installation_id) do update
  set provider_installation_id = excluded.provider_installation_id,
      platform = excluded.platform,
      app_version = excluded.app_version,
      last_seen_at = excluded.last_seen_at,
      revoked_at = null,
      updated_at = excluded.updated_at;
end;
$$;

create function public.unregister_push_device(p_installation_id uuid)
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
    and revoked_at is null;
end;
$$;

revoke all on table public.push_devices from anon, authenticated;
revoke execute on function public.register_push_device(uuid, text, text, text) from public;
revoke execute on function public.unregister_push_device(uuid) from public;
grant execute on function public.register_push_device(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.unregister_push_device(uuid)
  to authenticated, service_role;
