-- Close three review findings without widening any browser-facing table grants:
-- community profiles are projected through a safe RPC, expired announcements
-- leave the notification feed, and routine presence heartbeats are coalesced.

drop policy if exists "channel members read shared profiles" on public.profiles;
drop policy if exists "demo community members read room profiles" on public.profiles;

create or replace function public.list_channel_member_profiles(p_channel_id uuid)
returns table (
  id uuid,
  display_name text,
  username text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_channel_id is null or not exists (
    select 1
    from public.channel_members viewer
    where viewer.channel_id = p_channel_id
      and viewer.user_id = v_user_id
  ) then
    raise exception 'channel unavailable';
  end if;

  return query
  select profile.id, profile.display_name, profile.username
  from public.channel_members member
  join public.profiles profile on profile.id = member.user_id
  where member.channel_id = p_channel_id
    and (
      profile.id = v_user_id
      or not private.is_blocked_pair(v_user_id, profile.id)
    )
  order by profile.display_name, profile.id;
end;
$$;

revoke execute on function public.list_channel_member_profiles(uuid) from public;
grant execute on function public.list_channel_member_profiles(uuid) to authenticated;

create or replace function public.list_conversation_member_profiles(
  p_conversation_ids uuid[]
)
returns table (
  conversation_id uuid,
  id uuid,
  display_name text,
  username text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(cardinality(p_conversation_ids), 0) > 100 then
    raise exception 'too many conversations';
  end if;

  return query
  select distinct
    channel.conversation_id,
    profile.id,
    profile.display_name,
    profile.username
  from public.channels channel
  join public.channel_members member on member.channel_id = channel.id
  join public.profiles profile on profile.id = member.user_id
  where channel.conversation_id = any(
      coalesce(p_conversation_ids, array[]::uuid[])
    )
    and exists (
      select 1
      from public.channel_members viewer
      where viewer.channel_id = channel.id
        and viewer.user_id = v_user_id
    )
    and (
      profile.id = v_user_id
      or not private.is_blocked_pair(v_user_id, profile.id)
    )

  union

  select
    conversation.id,
    profile.id,
    profile.display_name,
    profile.username
  from public.conversations conversation
  join public.profiles profile
    on profile.id in (conversation.client_id, conversation.coach_id)
  where conversation.id = any(
      coalesce(p_conversation_ids, array[]::uuid[])
    )
    and not exists (
      select 1
      from public.channels channel
      where channel.conversation_id = conversation.id
    )
    and private.is_conversation_member(conversation.id)
  order by 1, 3, 2;
end;
$$;

revoke execute on function public.list_conversation_member_profiles(uuid[]) from public;
grant execute on function public.list_conversation_member_profiles(uuid[]) to authenticated;

create or replace function public.get_notification_summary()
returns table (
  unread_count integer,
  unseen_count integer,
  latest_change_seq bigint
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    count(*) filter (where item.read_at is null)::integer,
    count(*) filter (where item.seen_at is null)::integer,
    coalesce(max(item.change_seq), 0)::bigint
  from public.notification_items item
  where item.recipient_id = (select auth.uid())
    and item.archived_at is null
    and not exists (
      select 1
      from public.notification_events event
      join public.system_announcements announcement
        on announcement.id = event.announcement_id
      where event.id = item.latest_event_id
        and (
          announcement.starts_at > now()
          or (
            announcement.expires_at is not null
            and announcement.expires_at <= now()
          )
        )
    );
$$;

create or replace function public.list_notification_items(
  p_filter text default 'all',
  p_cursor_category_rank integer default null,
  p_cursor_last_event_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  kind text,
  category text,
  category_rank integer,
  actor_id uuid,
  actor_display_name text,
  actor_username text,
  actor_count integer,
  event_count integer,
  conversation_id uuid,
  channel_slug text,
  channel_name text,
  message_id uuid,
  message_snippet text,
  call_id uuid,
  friend_request_id uuid,
  moderation_action_id uuid,
  title text,
  body text,
  action_href text,
  seen_at timestamptz,
  read_at timestamptz,
  last_event_at timestamptz,
  change_seq bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_filter not in ('all', 'unread') then
    raise exception 'notification filter is invalid';
  end if;
  if (p_cursor_category_rank is null) <> (p_cursor_last_event_at is null)
    or (p_cursor_last_event_at is null) <> (p_cursor_id is null)
  then
    raise exception 'notification cursor is invalid';
  end if;

  return query
  with feed as (
    select
      item.*,
      case item.category
        when 'action_required' then 2
        when 'direct' then 1
        else 0
      end as rank
    from public.notification_items item
    where item.recipient_id = v_user_id
      and item.archived_at is null
      and (p_filter = 'all' or item.read_at is null)
      and not exists (
        select 1
        from public.notification_events latest_event
        join public.system_announcements latest_announcement
          on latest_announcement.id = latest_event.announcement_id
        where latest_event.id = item.latest_event_id
          and (
            latest_announcement.starts_at > now()
            or (
              latest_announcement.expires_at is not null
              and latest_announcement.expires_at <= now()
            )
          )
      )
  )
  select
    feed.id,
    feed.kind::text,
    feed.category::text,
    feed.rank,
    actor.id,
    actor.display_name,
    actor.username,
    coalesce(actor_summary.actor_count, 0),
    feed.event_count,
    event.conversation_id,
    channel.slug,
    channel.name,
    event.message_id,
    case
      when message.id is null then null
      when message.deleted_at is not null then 'Message deleted'
      when char_length(btrim(message.body)) <= 140 then btrim(message.body)
      else left(btrim(message.body), 139) || '…'
    end,
    event.call_id,
    event.friend_request_id,
    event.moderation_action_id,
    case
      when announcement.id is not null then announcement.title
      when moderation.id is not null then 'A moderation update'
      else null
    end,
    case
      when announcement.id is not null then announcement.body
      when moderation.id is not null then moderation.reason
      else null
    end,
    coalesce(announcement.action_href, moderation.action_href),
    feed.seen_at,
    feed.read_at,
    feed.last_event_at,
    feed.change_seq
  from feed
  left join public.notification_events event on event.id = feed.latest_event_id
  left join public.profiles actor on actor.id = event.actor_id
  left join public.messages message on message.id = event.message_id
  left join lateral (
    select c.slug, c.name
    from public.channels c
    where c.conversation_id = event.conversation_id
    order by c.created_at, c.id
    limit 1
  ) channel on true
  left join public.system_announcements announcement
    on announcement.id = event.announcement_id
  left join public.moderation_actions moderation
    on moderation.id = event.moderation_action_id
  left join lateral (
    select count(distinct active_event.actor_id)::integer as actor_count
    from public.notification_events active_event
    where active_event.item_id = feed.id
      and active_event.retracted_at is null
      and active_event.actor_id is not null
  ) actor_summary on true
  where p_cursor_category_rank is null
    or (feed.rank, feed.last_event_at, feed.id)
      < (p_cursor_category_rank, p_cursor_last_event_at, p_cursor_id)
  order by feed.rank desc, feed.last_event_at desc, feed.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50) + 1;
end;
$$;

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
  select preference.mode into v_mode
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

-- Include trusted subjects who have never opened the app so clients can
-- subscribe before their first snapshot INSERT. Missing rows are represented
-- as a stable Offline snapshot until the first session creates canonical data.
create or replace function public.list_visible_presence()
returns setof public.presence_snapshots
language sql
security definer
stable
set search_path = ''
as $$
  with viewer as (
    select (select auth.uid()) as id
  ),
  subjects as (
    select viewer.id as subject_id
    from viewer

    union

    select case
      when friendship.user_low_id = viewer.id then friendship.user_high_id
      else friendship.user_low_id
    end
    from public.friendships friendship
    cross join viewer
    where viewer.id in (friendship.user_low_id, friendship.user_high_id)

    union

    select case
      when assignment.coach_id = viewer.id then assignment.client_id
      else assignment.coach_id
    end
    from public.coach_clients assignment
    cross join viewer
    where viewer.id in (assignment.coach_id, assignment.client_id)
  )
  select
    subjects.subject_id as user_id,
    case
      when snapshot.user_id is null then 'offline'::public.presence_status
      when snapshot.status <> 'offline'
        and (
          snapshot.last_heartbeat_at is null
          or snapshot.last_heartbeat_at < now() - interval '90 seconds'
        )
        then 'offline'::public.presence_status
      else snapshot.status
    end as status,
    snapshot.last_heartbeat_at,
    snapshot.last_seen_at,
    coalesce(snapshot.revision, 0::bigint) as revision,
    coalesce(snapshot.updated_at, pg_catalog.to_timestamp(0)) as updated_at
  from subjects
  cross join viewer
  left join public.presence_snapshots snapshot
    on snapshot.user_id = subjects.subject_id
  where private.can_view_presence(viewer.id, subjects.subject_id)
  order by subjects.subject_id;
$$;

-- Relationship changes wake each affected user's subject-directory refresh.
-- Snapshot delivery still relies on presence_snapshots RLS for per-event
-- authorization, so a stale client-side filter cannot preserve revoked access.
create or replace function public.broadcast_presence_subjects_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_ids uuid[];
  v_user_id uuid;
begin
  if tg_table_name = 'friendships' then
    if tg_op = 'DELETE' then
      v_user_ids := array[old.user_low_id, old.user_high_id];
    else
      v_user_ids := array[new.user_low_id, new.user_high_id];
    end if;
  elsif tg_table_name = 'coach_clients' then
    if tg_op = 'DELETE' then
      v_user_ids := array[old.coach_id, old.client_id];
    elsif tg_op = 'UPDATE' then
      v_user_ids := array[
        old.coach_id,
        old.client_id,
        new.coach_id,
        new.client_id
      ];
    else
      v_user_ids := array[new.coach_id, new.client_id];
    end if;
  else
    if tg_op = 'DELETE' then
      v_user_ids := array[old.blocker_id, old.blocked_id];
    else
      v_user_ids := array[new.blocker_id, new.blocked_id];
    end if;
  end if;

  for v_user_id in
    select distinct candidate.id
    from unnest(v_user_ids) as candidate(id)
    where candidate.id is not null
  loop
    perform realtime.send(
      jsonb_build_object(
        'reason', 'relationship_changed',
        'occurredAt', now()
      ),
      'presence.subjects.changed',
      'presence:user:' || v_user_id::text,
      true
    );
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists broadcast_presence_subjects_changed_trigger
  on public.friendships;
create trigger broadcast_presence_subjects_changed_trigger
  after insert or delete on public.friendships
  for each row execute function public.broadcast_presence_subjects_changed();

drop trigger if exists broadcast_presence_subjects_changed_trigger
  on public.coach_clients;
create trigger broadcast_presence_subjects_changed_trigger
  after insert or update of coach_id, client_id or delete on public.coach_clients
  for each row execute function public.broadcast_presence_subjects_changed();

drop trigger if exists broadcast_presence_subjects_changed_trigger
  on public.user_blocks;
create trigger broadcast_presence_subjects_changed_trigger
  after insert or delete on public.user_blocks
  for each row execute function public.broadcast_presence_subjects_changed();

drop policy if exists "users receive own presence broadcasts"
  on realtime.messages;
drop policy if exists "trusted relationships receive presence broadcasts"
  on realtime.messages;

create policy "users receive own presence broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) =
      'presence:user:' || (select auth.uid())::text
  );

-- One snapshot row change replaces the prior per-viewer Broadcast loop.
-- Realtime applies the table's relationship-aware RLS policy to every change,
-- including inserts for related users who have never had a snapshot before.
do $$
begin
  execute 'alter publication supabase_realtime add table public.presence_snapshots';
exception
  when duplicate_object then null;
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
    select 1 from public.presence_sessions session
    where session.id = p_session_id and session.user_id <> v_user_id
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

  delete from public.presence_sessions session
  where session.user_id = v_user_id
    and session.id <> p_session_id
    and (
      session.last_heartbeat_at < v_now - interval '7 days'
      or (
        session.ended_at is not null
        and session.ended_at < v_now - interval '1 day'
      )
    );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );
  v_snapshot := private.refresh_presence_snapshot(v_user_id);
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );
  v_snapshot := private.refresh_presence_snapshot(v_user_id);
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

drop function if exists private.broadcast_presence_snapshot(
  uuid,
  public.presence_snapshots
);
