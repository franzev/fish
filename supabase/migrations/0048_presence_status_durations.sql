-- Manual presence modes can expire back to Automatic. The fixed durations
-- mirror the account-menu choices and keep arbitrary expiry values out of the
-- command boundary.

alter table public.presence_preferences
  add column expires_at timestamptz;

create or replace function private.refresh_presence_snapshot(subject_id uuid)
returns public.presence_snapshots
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_mode public.presence_mode := 'automatic'::public.presence_mode;
  v_has_fresh boolean := false;
  v_has_active boolean := false;
  v_last_heartbeat timestamptz;
  v_last_seen timestamptz;
  v_status public.presence_status := 'offline'::public.presence_status;
  v_snapshot public.presence_snapshots%rowtype;
begin
  select case
    when preference.expires_at is null or preference.expires_at > now()
      then preference.mode
    else 'automatic'::public.presence_mode
  end into v_mode
  from public.presence_preferences preference
  where preference.user_id = subject_id;
  v_mode := coalesce(v_mode, 'automatic'::public.presence_mode);

  select
    coalesce(bool_or(
      session.ended_at is null
      and session.last_heartbeat_at >= now() - interval '90 seconds'
    ), false),
    coalesce(bool_or(
      session.ended_at is null
      and session.last_heartbeat_at >= now() - interval '90 seconds'
      and session.active_at >= now() - interval '5 minutes'
    ), false),
    max(session.last_heartbeat_at),
    max(greatest(
      session.last_heartbeat_at,
      coalesce(session.ended_at, session.last_heartbeat_at)
    ))
  into v_has_fresh, v_has_active, v_last_heartbeat, v_last_seen
  from public.presence_sessions session
  where session.user_id = subject_id;

  if v_mode = 'invisible' then
    v_status := 'offline';
    v_last_heartbeat := null;
    v_last_seen := null;
  elsif not v_has_fresh then
    v_status := 'offline';
  elsif v_mode = 'away' then
    v_status := 'away';
  elsif v_mode = 'busy' then
    v_status := 'busy';
  elsif v_has_active then
    v_status := 'online';
  else
    v_status := 'idle';
  end if;

  insert into public.presence_snapshots (
    user_id,
    status,
    last_heartbeat_at,
    last_seen_at,
    revision,
    updated_at
  ) values (
    subject_id,
    v_status,
    v_last_heartbeat,
    v_last_seen,
    1,
    now()
  )
  on conflict (user_id) do update
  set status = excluded.status,
      last_heartbeat_at = excluded.last_heartbeat_at,
      last_seen_at = excluded.last_seen_at,
      revision = public.presence_snapshots.revision + 1,
      updated_at = excluded.updated_at
  where public.presence_snapshots.status is distinct from excluded.status
    or (
      public.presence_snapshots.last_heartbeat_at
        is distinct from excluded.last_heartbeat_at
      and (
        public.presence_snapshots.last_heartbeat_at is null
        or excluded.last_heartbeat_at is null
        or excluded.last_heartbeat_at >=
          public.presence_snapshots.last_heartbeat_at + interval '60 seconds'
      )
    )
  returning * into v_snapshot;

  if v_snapshot.user_id is null then
    select snapshot.* into v_snapshot
    from public.presence_snapshots snapshot
    where snapshot.user_id = subject_id;
  end if;

  return v_snapshot;
end;
$$;

create type public.presence_command_result as (
  user_id uuid,
  status public.presence_status,
  last_heartbeat_at timestamptz,
  last_seen_at timestamptz,
  revision bigint,
  updated_at timestamptz,
  preference_mode public.presence_mode,
  preference_expires_at timestamptz
);

drop function public.set_presence_mode(public.presence_mode);

create function public.set_presence_mode(
  p_mode public.presence_mode,
  p_duration_seconds integer default null
)
returns public.presence_command_result
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_expires_at timestamptz;
  v_snapshot public.presence_snapshots%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_mode is null then
    raise exception 'invalid presence mode';
  end if;
  if p_duration_seconds is not null and p_duration_seconds <> all (
    array[900, 3600, 28800, 86400, 259200]
  ) then
    raise exception 'invalid presence duration';
  end if;

  v_expires_at := case
    when p_duration_seconds is null then null
    else now() + pg_catalog.make_interval(secs => p_duration_seconds)
  end;

  insert into public.presence_preferences (
    user_id,
    mode,
    expires_at,
    updated_at
  ) values (
    v_user_id,
    p_mode,
    v_expires_at,
    now()
  )
  on conflict (user_id) do update
  set mode = excluded.mode,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );
  v_snapshot := private.refresh_presence_snapshot(v_user_id);
  perform realtime.send(
    jsonb_build_object(
      'mode', p_mode,
      'expiresAt', v_expires_at,
      'revision', v_snapshot.revision,
      'updatedAt', v_snapshot.updated_at
    ),
    'presence.preference.changed',
    'presence:user:' || v_user_id::text,
    true
  );
  return row(
    v_snapshot.user_id,
    v_snapshot.status,
    v_snapshot.last_heartbeat_at,
    v_snapshot.last_seen_at,
    v_snapshot.revision,
    v_snapshot.updated_at,
    p_mode,
    v_expires_at
  )::public.presence_command_result;
end;
$$;

revoke execute on function public.set_presence_mode(
  public.presence_mode,
  integer
) from public;
grant execute on function public.set_presence_mode(
  public.presence_mode,
  integer
) to authenticated, service_role;
