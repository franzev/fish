-- iOS direct-message notifications use the native APNs device token. Call
-- notifications remain Android-only until the iOS call experience is ready.

alter table public.push_devices
  drop constraint if exists push_devices_platform_check;

alter table public.push_devices
  add constraint push_devices_platform_check
  check (platform in ('android', 'ios'));

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

revoke execute on function public.register_push_device(uuid, text, text, text) from public;
grant execute on function public.register_push_device(uuid, text, text, text)
  to authenticated, service_role;
