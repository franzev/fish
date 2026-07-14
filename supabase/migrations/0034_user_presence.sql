-- App-wide, privacy-safe presence. Raw browser sessions stay private; trusted
-- relationships read sanitized snapshots and receive private Broadcast updates.

create type public.presence_mode as enum (
  'automatic',
  'away',
  'busy',
  'invisible'
);

create type public.presence_status as enum (
  'online',
  'idle',
  'away',
  'busy',
  'offline'
);

create table public.presence_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  mode public.presence_mode not null default 'automatic',
  updated_at timestamptz not null default now()
);

create table public.presence_snapshots (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.presence_status not null default 'offline',
  last_heartbeat_at timestamptz,
  last_seen_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

create index presence_sessions_heartbeat_cleanup_idx
  on public.presence_sessions (last_heartbeat_at);

alter table public.presence_preferences enable row level security;
alter table public.presence_snapshots enable row level security;

grant select on public.presence_preferences to authenticated;
grant select on public.presence_snapshots to authenticated;
grant select, insert, update, delete on public.presence_preferences to service_role;
grant select, insert, update, delete on public.presence_snapshots to service_role;

create or replace function private.can_view_presence(
  viewer_id uuid,
  subject_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    viewer_id is not null
    and subject_id is not null
    and (
      viewer_id = subject_id
      or (
        not private.is_blocked_pair(viewer_id, subject_id)
        and (
          private.are_friends(viewer_id, subject_id)
          or exists (
            select 1
            from public.coach_clients cc
            where (cc.coach_id = viewer_id and cc.client_id = subject_id)
              or (cc.client_id = viewer_id and cc.coach_id = subject_id)
          )
        )
      )
    );
$$;

create policy "users read own presence preference"
  on public.presence_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "trusted relationships read presence snapshots"
  on public.presence_snapshots
  for select
  to authenticated
  using (private.can_view_presence((select auth.uid()), user_id));

-- Raw sessions must not reveal that an Invisible user is still connected.
drop policy if exists "conversation partners read presence sessions"
  on public.presence_sessions;

create policy "users read own presence sessions"
  on public.presence_sessions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.refresh_presence_snapshot(subject_id uuid)
returns public.presence_snapshots
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_mode public.presence_mode := 'automatic';
  v_has_fresh boolean := false;
  v_has_active boolean := false;
  v_last_heartbeat timestamptz;
  v_last_seen timestamptz;
  v_status public.presence_status := 'offline';
  v_snapshot public.presence_snapshots%rowtype;
begin
  select pp.mode into v_mode
  from public.presence_preferences pp
  where pp.user_id = subject_id;
  v_mode := coalesce(v_mode, 'automatic'::public.presence_mode);

  select
    coalesce(bool_or(
      ps.ended_at is null
      and ps.last_heartbeat_at >= now() - interval '90 seconds'
    ), false),
    coalesce(bool_or(
      ps.ended_at is null
      and ps.last_heartbeat_at >= now() - interval '90 seconds'
      and ps.active_at >= now() - interval '5 minutes'
    ), false),
    max(ps.last_heartbeat_at),
    max(greatest(ps.last_heartbeat_at, coalesce(ps.ended_at, ps.last_heartbeat_at)))
  into v_has_fresh, v_has_active, v_last_heartbeat, v_last_seen
  from public.presence_sessions ps
  where ps.user_id = subject_id;

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
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

create or replace function private.broadcast_presence_snapshot(
  subject_id uuid,
  snapshot public.presence_snapshots
)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_payload jsonb := jsonb_build_object(
    'userId', snapshot.user_id,
    'status', snapshot.status,
    'lastHeartbeatAt', snapshot.last_heartbeat_at,
    'lastSeenAt', snapshot.last_seen_at,
    'revision', snapshot.revision,
    'updatedAt', snapshot.updated_at
  );
begin
  for v_viewer_id in
    select distinct viewer_id
    from (
      select subject_id as viewer_id
      union all
      select case
        when f.user_low_id = subject_id then f.user_high_id
        else f.user_low_id
      end
      from public.friendships f
      where subject_id in (f.user_low_id, f.user_high_id)
      union all
      select case
        when cc.coach_id = subject_id then cc.client_id
        else cc.coach_id
      end
      from public.coach_clients cc
      where subject_id in (cc.coach_id, cc.client_id)
    ) viewers
    where private.can_view_presence(viewer_id, subject_id)
  loop
    perform realtime.send(
      v_payload,
      'presence.changed',
      'presence:user:' || v_viewer_id::text,
      true
    );
  end loop;
end;
$$;

create or replace function public.touch_presence_session(
  p_session_id uuid,
  p_activity boolean default false,
  p_ended boolean default false
)
returns public.presence_snapshots
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_snapshot public.presence_snapshots%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_session_id is null then
    raise exception 'invalid presence session';
  end if;
  if exists (
    select 1 from public.presence_sessions ps
    where ps.id = p_session_id and ps.user_id <> v_user_id
  ) then
    raise exception 'presence session unavailable';
  end if;

  insert into public.presence_sessions (
    id,
    user_id,
    active_at,
    last_heartbeat_at,
    started_at,
    ended_at
  ) values (
    p_session_id,
    v_user_id,
    v_now,
    v_now,
    v_now,
    case when p_ended then v_now else null end
  )
  on conflict (id) do update
  set active_at = case
        when p_activity then v_now
        else public.presence_sessions.active_at
      end,
      last_heartbeat_at = v_now,
      ended_at = case when p_ended then v_now else null end
  where public.presence_sessions.user_id = v_user_id;

  delete from public.presence_sessions ps
  where ps.user_id = v_user_id
    and ps.id <> p_session_id
    and (
      ps.last_heartbeat_at < v_now - interval '7 days'
      or (ps.ended_at is not null and ps.ended_at < v_now - interval '1 day')
    );

  v_snapshot := private.refresh_presence_snapshot(v_user_id);
  perform private.broadcast_presence_snapshot(v_user_id, v_snapshot);
  return v_snapshot;
end;
$$;

create or replace function public.set_presence_mode(
  p_mode public.presence_mode
)
returns public.presence_snapshots
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_snapshot public.presence_snapshots%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_mode is null then
    raise exception 'invalid presence mode';
  end if;

  insert into public.presence_preferences (user_id, mode, updated_at)
  values (v_user_id, p_mode, now())
  on conflict (user_id) do update
  set mode = excluded.mode,
      updated_at = excluded.updated_at;

  v_snapshot := private.refresh_presence_snapshot(v_user_id);
  perform private.broadcast_presence_snapshot(v_user_id, v_snapshot);
  perform realtime.send(
    jsonb_build_object(
      'mode', p_mode,
      'revision', v_snapshot.revision,
      'updatedAt', v_snapshot.updated_at
    ),
    'presence.preference.changed',
    'presence:user:' || v_user_id::text,
    true
  );
  return v_snapshot;
end;
$$;

create or replace function public.list_visible_presence()
returns setof public.presence_snapshots
language sql
security definer
stable
set search_path = ''
as $$
  select
    ps.user_id,
    case
      when ps.status <> 'offline'
        and (
          ps.last_heartbeat_at is null
          or ps.last_heartbeat_at < now() - interval '90 seconds'
        )
        then 'offline'::public.presence_status
      else ps.status
    end as status,
    ps.last_heartbeat_at,
    ps.last_seen_at,
    ps.revision,
    ps.updated_at
  from public.presence_snapshots ps
  where private.can_view_presence((select auth.uid()), ps.user_id)
  order by ps.user_id;
$$;

create or replace function public.cleanup_presence_sessions()
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.presence_sessions ps
  where ps.last_heartbeat_at < now() - interval '7 days'
    or (ps.ended_at is not null and ps.ended_at < now() - interval '1 day');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.touch_presence_session(uuid, boolean, boolean) from public;
revoke execute on function public.set_presence_mode(public.presence_mode) from public;
revoke execute on function public.list_visible_presence() from public;
revoke execute on function public.cleanup_presence_sessions() from public;
grant execute on function public.touch_presence_session(uuid, boolean, boolean) to authenticated;
grant execute on function public.set_presence_mode(public.presence_mode) to authenticated;
grant execute on function public.list_visible_presence() to authenticated;

create policy "users receive own presence broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) =
      'presence:user:' || (select auth.uid())::text
  );

-- Snapshots are broadcast explicitly. Raw session heartbeats no longer need
-- Postgres Changes fanout.
do $$
begin
  execute 'alter publication supabase_realtime drop table public.presence_sessions';
exception
  when undefined_object then null;
end;
$$;

-- Supabase projects include pg_cron; the named job remains idempotent across resets.
create extension if not exists pg_cron with schema extensions;
select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-presence-sessions-daily';
select cron.schedule(
  'cleanup-presence-sessions-daily',
  '17 3 * * *',
  'select public.cleanup_presence_sessions();'
);
