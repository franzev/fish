-- Durable notification center. Domain tables remain authoritative; these rows
-- are a recipient-specific inbox projection with deterministic aggregation,
-- monotonic acknowledgement state, bounded reads, and realtime wake-up hints.

create type public.notification_kind as enum (
  'friend_request_received',
  'friend_request_accepted',
  'system_announcement',
  'product_update',
  'moderation_action',
  'call_missed',
  'call_completed',
  'message_mention',
  'message_reply',
  'message_reaction'
);

create type public.notification_category as enum (
  'action_required',
  'direct',
  'update'
);

create sequence public.notification_change_seq;

create table public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  kind public.notification_kind not null default 'system_announcement'
    check (kind in ('system_announcement', 'product_update')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  action_href text check (
    action_href is null
    or (action_href like '/%' and action_href not like '//%')
  ),
  audience_role text check (audience_role is null or audience_role in ('client', 'coach')),
  category public.notification_category not null default 'update'
    check (category in ('direct', 'update')),
  published_by uuid references public.profiles (id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_announcements_time_order
    check (expires_at is null or expires_at > starts_at)
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  moderator_id uuid references public.profiles (id) on delete set null,
  action_type text not null check (action_type in (
    'message_removed', 'content_warning', 'account_notice', 'access_limited'
  )),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  subject_message_id uuid references public.messages (id) on delete set null,
  action_href text check (
    action_href is null
    or (action_href like '/%' and action_href not like '//%')
  ),
  requires_acknowledgement boolean not null default true,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_items (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  category public.notification_category not null,
  aggregate_key text not null check (char_length(aggregate_key) between 1 and 240),
  event_count integer not null default 0 check (event_count >= 0),
  latest_event_id uuid,
  first_event_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  seen_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  archive_batch_id uuid,
  change_seq bigint not null default nextval('public.notification_change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_items_recipient_aggregate_unique
    unique (recipient_id, aggregate_key),
  constraint notification_items_time_order check (
    first_event_at <= last_event_at
  )
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.notification_items (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  call_id uuid references public.calls (id) on delete cascade,
  friend_request_id uuid references public.friend_requests (id) on delete cascade,
  announcement_id uuid references public.system_announcements (id) on delete cascade,
  moderation_action_id uuid references public.moderation_actions (id) on delete cascade,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 240),
  payload_version smallint not null default 1 check (payload_version > 0),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retracted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_events_recipient_dedupe_unique
    unique (recipient_id, dedupe_key),
  constraint notification_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint notification_events_retraction_order
    check (retracted_at is null or retracted_at >= occurred_at)
);

alter table public.notification_items
  add constraint notification_items_latest_event_fk
  foreign key (latest_event_id)
  references public.notification_events (id)
  on delete set null;

create index notification_items_active_feed_idx
  on public.notification_items (
    recipient_id,
    category,
    last_event_at desc,
    id desc
  )
  where archived_at is null;

create index notification_items_unread_idx
  on public.notification_items (recipient_id, last_event_at desc, id desc)
  where archived_at is null and read_at is null;

create index notification_items_sync_idx
  on public.notification_items (recipient_id, change_seq);

create index notification_events_item_active_idx
  on public.notification_events (item_id, occurred_at desc, id desc)
  where retracted_at is null;

create index notification_events_message_idx
  on public.notification_events (message_id, recipient_id)
  where message_id is not null;

create index system_announcements_active_idx
  on public.system_announcements (starts_at, expires_at, audience_role);

alter table public.system_announcements enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.notification_items enable row level security;
alter table public.notification_events enable row level security;

grant select on public.system_announcements to authenticated;
grant select on public.moderation_actions to authenticated;
grant select on public.notification_items to authenticated;
grant select on public.notification_events to authenticated;
grant select, insert, update, delete on public.system_announcements to service_role;
grant select, insert, update, delete on public.moderation_actions to service_role;
grant select, insert, update, delete on public.notification_items to service_role;
grant select, insert, update, delete on public.notification_events to service_role;

create policy "users read applicable announcements"
  on public.system_announcements
  for select
  to authenticated
  using (
    starts_at <= now()
    and (expires_at is null or expires_at > now())
    and (
      audience_role is null
      or audience_role = (
        select profile.role from public.profiles profile
        where profile.id = (select auth.uid())
      )
    )
  );

create policy "recipients read moderation actions"
  on public.moderation_actions
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "recipients read notification items"
  on public.notification_items
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "recipients read notification events"
  on public.notification_events
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create or replace function private.is_user_conversation_member(
  conversation_uuid uuid,
  user_uuid uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select user_uuid is not null and (
    exists (
      select 1
      from public.channels channel
      join public.channel_members member on member.channel_id = channel.id
      where channel.conversation_id = conversation_uuid
        and member.user_id = user_uuid
    )
    or exists (
      select 1
      from public.conversations conversation
      join public.coach_clients assignment
        on assignment.coach_id = conversation.coach_id
       and assignment.client_id = conversation.client_id
      where conversation.id = conversation_uuid
        and user_uuid in (conversation.client_id, conversation.coach_id)
    )
  );
$$;

create or replace function private.emit_notification_event(
  p_recipient_id uuid,
  p_kind public.notification_kind,
  p_category public.notification_category,
  p_aggregate_key text,
  p_dedupe_key text,
  p_actor_id uuid default null,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_call_id uuid default null,
  p_friend_request_id uuid default null,
  p_announcement_id uuid default null,
  p_moderation_action_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now(),
  p_mark_read boolean default false
)
returns public.notification_items
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_item public.notification_items%rowtype;
  v_event_id uuid;
begin
  if p_recipient_id is null
    or p_aggregate_key is null
    or btrim(p_aggregate_key) = ''
    or p_dedupe_key is null
    or btrim(p_dedupe_key) = ''
  then
    raise exception 'notification identity is required';
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'notification recipient not found';
  end if;

  if p_actor_id is not null and exists (
    select 1
    from public.user_blocks block
    where (block.blocker_id = p_recipient_id and block.blocked_id = p_actor_id)
       or (block.blocker_id = p_actor_id and block.blocked_id = p_recipient_id)
  ) then
    return null;
  end if;

  insert into public.notification_items (
    recipient_id,
    kind,
    category,
    aggregate_key,
    first_event_at,
    last_event_at,
    read_at
  )
  values (
    p_recipient_id,
    p_kind,
    p_category,
    btrim(p_aggregate_key),
    p_occurred_at,
    p_occurred_at,
    case when p_mark_read then p_occurred_at else null end
  )
  on conflict on constraint notification_items_recipient_aggregate_unique
  do nothing;

  select * into v_item
  from public.notification_items item
  where item.recipient_id = p_recipient_id
    and item.aggregate_key = btrim(p_aggregate_key)
  for update;

  insert into public.notification_events (
    item_id,
    recipient_id,
    kind,
    actor_id,
    conversation_id,
    message_id,
    call_id,
    friend_request_id,
    announcement_id,
    moderation_action_id,
    dedupe_key,
    metadata,
    occurred_at
  )
  values (
    v_item.id,
    p_recipient_id,
    p_kind,
    p_actor_id,
    p_conversation_id,
    p_message_id,
    p_call_id,
    p_friend_request_id,
    p_announcement_id,
    p_moderation_action_id,
    btrim(p_dedupe_key),
    coalesce(p_metadata, '{}'::jsonb),
    p_occurred_at
  )
  on conflict on constraint notification_events_recipient_dedupe_unique
  do update set
    actor_id = excluded.actor_id,
    conversation_id = excluded.conversation_id,
    message_id = excluded.message_id,
    call_id = excluded.call_id,
    friend_request_id = excluded.friend_request_id,
    announcement_id = excluded.announcement_id,
    moderation_action_id = excluded.moderation_action_id,
    metadata = excluded.metadata,
    occurred_at = excluded.occurred_at,
    retracted_at = null
  where notification_events.retracted_at is not null
  returning id into v_event_id;

  if v_event_id is null then
    return v_item;
  end if;

  update public.notification_items
  set kind = p_kind,
      category = p_category,
      event_count = event_count + 1,
      latest_event_id = v_event_id,
      first_event_at = least(first_event_at, p_occurred_at),
      last_event_at = greatest(last_event_at, p_occurred_at),
      seen_at = case when p_mark_read then coalesce(seen_at, p_occurred_at) else null end,
      read_at = case when p_mark_read then coalesce(read_at, p_occurred_at) else null end,
      archived_at = null,
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where id = v_item.id
  returning * into v_item;

  return v_item;
end;
$$;

create or replace function private.retract_notification_event(
  p_recipient_id uuid,
  p_dedupe_key text,
  p_retracted_at timestamptz default now()
)
returns public.notification_items
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_event public.notification_events%rowtype;
  v_item public.notification_items%rowtype;
  v_latest_event_id uuid;
  v_latest_event_at timestamptz;
  v_active_count integer;
begin
  select * into v_event
  from public.notification_events event
  where event.recipient_id = p_recipient_id
    and event.dedupe_key = p_dedupe_key
  for update;

  if not found or v_event.retracted_at is not null then
    return null;
  end if;

  update public.notification_events
  set retracted_at = greatest(p_retracted_at, occurred_at)
  where id = v_event.id;

  select event.id, event.occurred_at
  into v_latest_event_id, v_latest_event_at
  from public.notification_events event
  where event.item_id = v_event.item_id
    and event.retracted_at is null
  order by event.occurred_at desc, event.id desc
  limit 1;

  select count(*)::integer into v_active_count
  from public.notification_events event
  where event.item_id = v_event.item_id
    and event.retracted_at is null;

  update public.notification_items
  set event_count = v_active_count,
      latest_event_id = v_latest_event_id,
      last_event_at = coalesce(v_latest_event_at, last_event_at),
      archived_at = case when v_active_count = 0 then now() else archived_at end,
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where id = v_event.item_id
  returning * into v_item;

  return v_item;
end;
$$;

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
    and item.archived_at is null;
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

create or replace function public.list_notification_changes(
  p_after_change_seq bigint default 0,
  p_limit integer default 100
)
returns table (
  id uuid,
  change_seq bigint,
  seen_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz
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
  return query
  select item.id, item.change_seq, item.seen_at, item.read_at, item.archived_at
  from public.notification_items item
  where item.recipient_id = v_user_id
    and item.change_seq > greatest(coalesce(p_after_change_seq, 0), 0)
  order by item.change_seq, item.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

create or replace function public.list_navigation_attention()
returns table (
  surface text,
  entity_id uuid,
  conversation_id uuid,
  unread_count integer,
  mention_count integer,
  new_activity boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  with member_surfaces as (
    select
      'channel'::text as surface,
      channel.id as entity_id,
      channel.conversation_id
    from public.channels channel
    join public.channel_members member on member.channel_id = channel.id
    where member.user_id = (select auth.uid())

    union all

    select
      'direct'::text,
      conversation.id,
      conversation.id
    from public.conversations conversation
    where (select auth.uid()) in (conversation.client_id, conversation.coach_id)
      and not exists (
        select 1 from public.channels channel
        where channel.conversation_id = conversation.id
      )
  ),
  unread as (
    select
      member.surface,
      member.entity_id,
      member.conversation_id,
      count(message.id)::integer as unread_count,
      count(message.id) filter (
        where exists (
          select 1
          from public.message_mentions mention
          where mention.message_id = message.id
            and mention.mentioned_user_id = (select auth.uid())
        )
      )::integer as mention_count
    from member_surfaces member
    left join public.message_reads read_state
      on read_state.conversation_id = member.conversation_id
      and read_state.user_id = (select auth.uid())
    left join public.messages read_message
      on read_message.id = read_state.last_read_message_id
    left join public.messages message
      on message.conversation_id = member.conversation_id
      and message.sender_id <> (select auth.uid())
      and message.deleted_at is null
      and (
        read_message.id is null
        or (message.created_at, message.id) > (read_message.created_at, read_message.id)
      )
    group by member.surface, member.entity_id, member.conversation_id
  )
  select
    unread.surface,
    unread.entity_id,
    unread.conversation_id,
    unread.unread_count,
    unread.mention_count,
    unread.unread_count > 0
  from unread

  union all

  select
    'friends'::text,
    null::uuid,
    null::uuid,
    count(request.id)::integer,
    0,
    count(request.id) > 0
  from public.friend_requests request
  where request.recipient_id = (select auth.uid())
    and request.status = 'pending';
$$;

create or replace function public.mark_notifications_seen(
  p_notification_ids uuid[],
  p_through_change_seq bigint
)
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  update public.notification_items
  set seen_at = coalesce(seen_at, now()),
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where recipient_id = (select auth.uid())
    and id = any(coalesce(p_notification_ids, '{}'::uuid[]))
    and change_seq <= p_through_change_seq
    and seen_at is null
    and archived_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.mark_notifications_read(
  p_notification_ids uuid[],
  p_through_change_seq bigint
)
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  update public.notification_items
  set seen_at = coalesce(seen_at, now()),
      read_at = coalesce(read_at, now()),
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where recipient_id = (select auth.uid())
    and id = any(coalesce(p_notification_ids, '{}'::uuid[]))
    and change_seq <= p_through_change_seq
    and read_at is null
    and archived_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.mark_all_notifications_read(
  p_through_change_seq bigint
)
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  update public.notification_items
  set seen_at = coalesce(seen_at, now()),
      read_at = coalesce(read_at, now()),
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where recipient_id = (select auth.uid())
    and change_seq <= p_through_change_seq
    and read_at is null
    and archived_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.archive_read_notifications(
  p_through_change_seq bigint
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_count integer;
  v_archive_batch_id uuid := gen_random_uuid();
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  update public.notification_items
  set archived_at = now(),
      archive_batch_id = v_archive_batch_id,
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where recipient_id = (select auth.uid())
    and change_seq <= p_through_change_seq
    and read_at is not null
    and category <> 'action_required'
    and archived_at is null;
  get diagnostics v_count = row_count;
  return jsonb_build_object(
    'updated', v_count,
    'archiveBatchId', case when v_count > 0 then v_archive_batch_id else null end
  );
end;
$$;

create or replace function public.restore_notifications(p_notification_ids uuid[])
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  update public.notification_items
  set archived_at = null,
      archive_batch_id = null,
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where recipient_id = (select auth.uid())
    and id = any(coalesce(p_notification_ids, '{}'::uuid[]))
    and archived_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.restore_notification_batch(p_archive_batch_id uuid)
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  update public.notification_items
  set archived_at = null,
      archive_batch_id = null,
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where recipient_id = (select auth.uid())
    and archive_batch_id = p_archive_batch_id
    and archived_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.publish_system_announcement(
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_action_href text default null,
  p_audience_role text default null,
  p_category public.notification_category default 'update',
  p_starts_at timestamptz default now(),
  p_expires_at timestamptz default null
)
returns public.system_announcements
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_announcement public.system_announcements%rowtype;
  v_profile record;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'announcement not allowed';
  end if;
  if p_starts_at > now() or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'announcement must be active when published';
  end if;
  insert into public.system_announcements (
    kind, title, body, action_href, audience_role, category,
    starts_at, expires_at
  ) values (
    p_kind, btrim(p_title), btrim(p_body), p_action_href, p_audience_role,
    p_category, p_starts_at, p_expires_at
  ) returning * into v_announcement;

  for v_profile in
    select profile.id
    from public.profiles profile
    where p_audience_role is null or profile.role = p_audience_role
  loop
    perform private.emit_notification_event(
      v_profile.id,
      p_kind,
      p_category,
      'announcement:' || v_announcement.id::text,
      'announcement:' || v_announcement.id::text,
      null,
      null,
      null,
      null,
      null,
      v_announcement.id,
      null,
      '{}'::jsonb,
      p_starts_at,
      false
    );
  end loop;
  return v_announcement;
end;
$$;

create or replace function public.create_moderation_action(
  p_recipient_id uuid,
  p_action_type text,
  p_reason text,
  p_subject_message_id uuid default null,
  p_action_href text default null,
  p_requires_acknowledgement boolean default true
)
returns public.moderation_actions
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_action public.moderation_actions%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'moderation action not allowed';
  end if;
  insert into public.moderation_actions (
    recipient_id, action_type, reason, subject_message_id,
    action_href, requires_acknowledgement
  ) values (
    p_recipient_id, p_action_type, btrim(p_reason), p_subject_message_id,
    p_action_href, p_requires_acknowledgement
  ) returning * into v_action;

  perform private.emit_notification_event(
    p_recipient_id,
    'moderation_action',
    case when p_requires_acknowledgement
      then 'action_required'::public.notification_category
      else 'update'::public.notification_category
    end,
    'moderation:' || v_action.id::text,
    'moderation:' || v_action.id::text,
    null,
    null,
    p_subject_message_id,
    null,
    null,
    null,
    v_action.id,
    '{}'::jsonb,
    v_action.created_at,
    not p_requires_acknowledgement
  );
  return v_action;
end;
$$;

create or replace function public.acknowledge_moderation_action(p_action_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_action public.moderation_actions%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  update public.moderation_actions action
  set acknowledged_at = coalesce(action.acknowledged_at, now())
  where action.id = p_action_id
    and action.recipient_id = (select auth.uid())
    and action.requires_acknowledgement
  returning * into v_action;
  if not found then return false; end if;
  perform private.retract_notification_event(
    v_action.recipient_id,
    'moderation:' || v_action.id::text,
    coalesce(v_action.acknowledged_at, now())
  );
  return true;
end;
$$;

create or replace function public.broadcast_notification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.latest_event_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'itemId', new.id,
        'changeSeq', new.change_seq,
        'reason', case
          when tg_op = 'INSERT' then 'created'
          when new.archived_at is distinct from old.archived_at then
            case when new.archived_at is null then 'restored' else 'archived' end
          when new.read_at is distinct from old.read_at then 'read'
          when new.seen_at is distinct from old.seen_at then 'seen'
          else 'updated'
        end,
        'occurredAt', new.updated_at
      ),
      'notifications.changed',
      'notifications:user:' || new.recipient_id::text,
      true
    );
  end if;
  return new;
end;
$$;

create trigger broadcast_notification_change_trigger
  after insert or update on public.notification_items
  for each row execute function public.broadcast_notification_change();

create or replace function public.broadcast_conversation_attention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid := new.conversation_id;
begin
  perform realtime.send(
    jsonb_build_object(
      'conversationId', v_conversation_id,
      'reason', case when tg_table_name = 'messages' then 'message' else 'read_state' end,
      'occurredAt', now()
    ),
    'attention.changed',
    'attention:conversation:' || v_conversation_id::text,
    true
  );
  return new;
end;
$$;

create trigger broadcast_message_attention_trigger
  after insert or update of body, deleted_at on public.messages
  for each row execute function public.broadcast_conversation_attention();

create trigger broadcast_read_attention_trigger
  after insert or update of last_read_message_id on public.message_reads
  for each row execute function public.broadcast_conversation_attention();

create policy "users receive own notification broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) =
      'notifications:user:' || (select auth.uid())::text
  );

create policy "members receive conversation attention broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^attention:conversation:[0-9a-f-]{36}$'
    and private.is_user_conversation_member(
      substring((select realtime.topic()) from 24)::uuid,
      (select auth.uid())
    )
  );

-- Keep structured mention rows membership-safe. The original parser could
-- resolve a globally visible username that was not part of the conversation.
create or replace function public.sync_message_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.message_mentions where message_id = new.id;

  if new.deleted_at is null then
    insert into public.message_mentions (message_id, conversation_id, mentioned_user_id)
    select distinct new.id, new.conversation_id, profile.id
    from regexp_matches(
      lower(new.body),
      '(^|[^[:alnum:]_])@([a-z0-9_]{3,64})',
      'g'
    ) as matches(parts)
    join public.profiles profile on profile.username = matches.parts[2]
    where profile.id <> new.sender_id
      and private.is_user_conversation_member(new.conversation_id, profile.id);
  end if;

  return new;
end;
$$;

create or replace function public.sync_friend_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.emit_notification_event(
      new.recipient_id,
      'friend_request_received',
      'action_required',
      'friend-request:' || new.id::text,
      'friend-request-received:' || new.id::text,
      new.sender_id,
      null,
      null,
      null,
      new.id,
      null,
      null,
      '{}'::jsonb,
      new.created_at,
      false
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    perform private.retract_notification_event(
      new.recipient_id,
      'friend-request-received:' || new.id::text,
      new.updated_at
    );
    if new.status = 'accepted' then
      perform private.emit_notification_event(
        new.sender_id,
        'friend_request_accepted',
        'update',
        'friend-accepted:' || new.id::text,
        'friend-request-accepted:' || new.id::text,
        new.recipient_id,
        null,
        null,
        null,
        new.id,
        null,
        null,
        '{}'::jsonb,
        new.updated_at,
        false
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger sync_friend_request_notification_trigger
  after insert or update of status on public.friend_requests
  for each row execute function public.sync_friend_request_notification();

create or replace function public.archive_blocked_user_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_items item
  set archived_at = now(),
      archive_batch_id = null,
      change_seq = nextval('public.notification_change_seq'),
      updated_at = now()
  where item.archived_at is null
    and (
      (item.recipient_id = new.blocker_id and exists (
        select 1 from public.notification_events event
        where event.item_id = item.id and event.actor_id = new.blocked_id
      ))
      or
      (item.recipient_id = new.blocked_id and exists (
        select 1 from public.notification_events event
        where event.item_id = item.id and event.actor_id = new.blocker_id
      ))
    );
  return new;
end;
$$;

create trigger archive_blocked_user_notifications_trigger
  after insert on public.user_blocks
  for each row execute function public.archive_blocked_user_notifications();

create or replace function public.sync_call_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  if tg_op <> 'UPDATE' or new.status = old.status then return new; end if;

  if new.status = 'missed' then
    v_recipient_id := case
      when new.initiated_by = new.coach_id then new.client_id
      else new.coach_id
    end;
    perform private.emit_notification_event(
      v_recipient_id,
      'call_missed',
      'direct',
      'missed-calls:' || new.initiated_by::text || ':' ||
        to_char(coalesce(new.ended_at, new.updated_at) at time zone 'UTC', 'YYYY-MM-DD'),
      'call-missed:' || new.id::text,
      new.initiated_by,
      null,
      null,
      new.id,
      null,
      null,
      null,
      '{}'::jsonb,
      coalesce(new.ended_at, new.updated_at),
      false
    );
  elsif new.status in ('ended', 'failed')
    and old.status in ('connecting', 'active')
  then
    perform private.emit_notification_event(
      new.coach_id,
      'call_completed',
      'update',
      'call-completed:' || new.id::text || ':' || new.coach_id::text,
      'call-completed:' || new.id::text || ':' || new.coach_id::text,
      new.client_id,
      null,
      null,
      new.id,
      null,
      null,
      null,
      jsonb_build_object('status', new.status, 'endReason', new.end_reason),
      coalesce(new.ended_at, new.updated_at),
      true
    );
    perform private.emit_notification_event(
      new.client_id,
      'call_completed',
      'update',
      'call-completed:' || new.id::text || ':' || new.client_id::text,
      'call-completed:' || new.id::text || ':' || new.client_id::text,
      new.coach_id,
      null,
      null,
      new.id,
      null,
      null,
      null,
      jsonb_build_object('status', new.status, 'endReason', new.end_reason),
      coalesce(new.ended_at, new.updated_at),
      true
    );
  end if;
  return new;
end;
$$;

create trigger sync_call_notification_trigger
  after update of status on public.calls
  for each row execute function public.sync_call_notification();

create or replace function public.sync_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mention record;
  v_previous_mention record;
  v_reply_author uuid;
begin
  for v_mention in
    select mention.mentioned_user_id
    from public.message_mentions mention
    where mention.message_id = new.id
  loop
    perform private.emit_notification_event(
      v_mention.mentioned_user_id,
      'message_mention',
      'direct',
      'message-attention:' || new.id::text || ':' || v_mention.mentioned_user_id::text,
      'message-mention:' || new.id::text || ':' || v_mention.mentioned_user_id::text,
      new.sender_id,
      new.conversation_id,
      new.id,
      null,
      null,
      null,
      null,
      '{}'::jsonb,
      coalesce(new.edited_at, new.created_at),
      false
    );
  end loop;

  if tg_op = 'UPDATE' then
    for v_previous_mention in
      select distinct profile.id as mentioned_user_id
      from regexp_matches(
        lower(old.body),
        '(^|[^[:alnum:]_])@([a-z0-9_]{3,64})',
        'g'
      ) as matches(parts)
      join public.profiles profile on profile.username = matches.parts[2]
      where not exists (
        select 1 from public.message_mentions current_mention
        where current_mention.message_id = new.id
          and current_mention.mentioned_user_id = profile.id
      )
    loop
      perform private.retract_notification_event(
        v_previous_mention.mentioned_user_id,
        'message-mention:' || new.id::text || ':' || v_previous_mention.mentioned_user_id::text,
        now()
      );
    end loop;
  end if;

  if new.deleted_at is not null then
    for v_previous_mention in
      select event.recipient_id, event.dedupe_key
      from public.notification_events event
      where event.message_id = new.id
        and event.retracted_at is null
    loop
      perform private.retract_notification_event(
        v_previous_mention.recipient_id,
        v_previous_mention.dedupe_key,
        now()
      );
    end loop;
    return new;
  end if;

  if tg_op = 'INSERT' and new.reply_to_message_id is not null then
    select message.sender_id into v_reply_author
    from public.messages message
    where message.id = new.reply_to_message_id;

    if v_reply_author is not null
      and v_reply_author <> new.sender_id
      and not exists (
        select 1 from public.message_mentions mention
        where mention.message_id = new.id
          and mention.mentioned_user_id = v_reply_author
      )
      and private.is_user_conversation_member(new.conversation_id, v_reply_author)
    then
      perform private.emit_notification_event(
        v_reply_author,
        'message_reply',
        'direct',
        'message-attention:' || new.id::text || ':' || v_reply_author::text,
        'message-reply:' || new.id::text || ':' || v_reply_author::text,
        new.sender_id,
        new.conversation_id,
        new.id,
        null,
        null,
        null,
        null,
        jsonb_build_object('replyToMessageId', new.reply_to_message_id),
        new.created_at,
        false
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger zz_sync_message_notification_trigger
  after insert or update of body, deleted_at on public.messages
  for each row execute function public.sync_message_notification();

create or replace function public.sync_reaction_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author_id uuid;
begin
  select message.sender_id into v_author_id
  from public.messages message
  where message.id = new.message_id
    and message.deleted_at is null;

  if v_author_id is null or v_author_id = new.user_id then return new; end if;

  if new.removed_at is null then
    perform private.emit_notification_event(
      v_author_id,
      'message_reaction',
      'update',
      'message-reactions:' || new.message_id::text || ':' || v_author_id::text,
      'message-reaction:' || new.id::text,
      new.user_id,
      new.conversation_id,
      new.message_id,
      null,
      null,
      null,
      null,
      jsonb_build_object('emoji', new.emoji),
      new.created_at,
      false
    );
  else
    perform private.retract_notification_event(
      v_author_id,
      'message-reaction:' || new.id::text,
      new.removed_at
    );
  end if;
  return new;
end;
$$;

create trigger sync_reaction_notification_trigger
  after insert or update of removed_at on public.message_reactions
  for each row execute function public.sync_reaction_notification();

create or replace function public.provision_active_announcements_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_announcement public.system_announcements%rowtype;
begin
  for v_announcement in
    select announcement.*
    from public.system_announcements announcement
    where announcement.starts_at <= now()
      and (announcement.expires_at is null or announcement.expires_at > now())
      and (announcement.audience_role is null or announcement.audience_role = new.role)
  loop
    perform private.emit_notification_event(
      new.id,
      v_announcement.kind,
      v_announcement.category,
      'announcement:' || v_announcement.id::text,
      'announcement:' || v_announcement.id::text || ':' || new.id::text,
      null,
      null,
      null,
      null,
      null,
      v_announcement.id,
      null,
      '{}'::jsonb,
      greatest(v_announcement.starts_at, now()),
      false
    );
  end loop;
  return new;
end;
$$;

create trigger provision_active_announcements_for_profile_trigger
  after insert on public.profiles
  for each row execute function public.provision_active_announcements_for_profile();

-- Backfill the narrow friend notification projection before the web switches
-- to the generalized notification center.
do $$
declare
  v_notification record;
begin
  for v_notification in
    select * from public.user_notifications
  loop
    perform private.emit_notification_event(
      v_notification.recipient_id,
      case v_notification.kind
        when 'friend_request_received' then 'friend_request_received'::public.notification_kind
        else 'friend_request_accepted'::public.notification_kind
      end,
      case v_notification.kind
        when 'friend_request_received' then 'action_required'::public.notification_category
        else 'update'::public.notification_category
      end,
      case v_notification.kind
        when 'friend_request_received' then 'friend-request:' || v_notification.entity_id::text
        else 'friend-accepted:' || v_notification.entity_id::text
      end,
      'legacy-friend-notification:' || v_notification.id::text,
      v_notification.actor_id,
      null,
      null,
      null,
      v_notification.entity_id,
      null,
      null,
      '{}'::jsonb,
      v_notification.created_at,
      v_notification.read_at is not null
    );
  end loop;
end;
$$;

revoke execute on function public.get_notification_summary() from public;
revoke execute on function public.list_notification_items(text, integer, timestamptz, uuid, integer) from public;
revoke execute on function public.list_notification_changes(bigint, integer) from public;
revoke execute on function public.list_navigation_attention() from public;
revoke execute on function public.mark_notifications_seen(uuid[], bigint) from public;
revoke execute on function public.mark_notifications_read(uuid[], bigint) from public;
revoke execute on function public.mark_all_notifications_read(bigint) from public;
revoke execute on function public.archive_read_notifications(bigint) from public;
revoke execute on function public.restore_notifications(uuid[]) from public;
revoke execute on function public.restore_notification_batch(uuid) from public;
revoke execute on function public.publish_system_announcement(public.notification_kind, text, text, text, text, public.notification_category, timestamptz, timestamptz) from public;
revoke execute on function public.create_moderation_action(uuid, text, text, uuid, text, boolean) from public;
revoke execute on function public.acknowledge_moderation_action(uuid) from public;

grant execute on function public.get_notification_summary() to authenticated;
grant execute on function public.list_notification_items(text, integer, timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_notification_changes(bigint, integer) to authenticated;
grant execute on function public.list_navigation_attention() to authenticated;
grant execute on function public.mark_notifications_seen(uuid[], bigint) to authenticated;
grant execute on function public.mark_notifications_read(uuid[], bigint) to authenticated;
grant execute on function public.mark_all_notifications_read(bigint) to authenticated;
grant execute on function public.archive_read_notifications(bigint) to authenticated;
grant execute on function public.restore_notifications(uuid[]) to authenticated;
grant execute on function public.restore_notification_batch(uuid) to authenticated;
grant execute on function public.publish_system_announcement(public.notification_kind, text, text, text, text, public.notification_category, timestamptz, timestamptz) to service_role;
grant execute on function public.create_moderation_action(uuid, text, text, uuid, text, boolean) to service_role;
grant execute on function public.acknowledge_moderation_action(uuid) to authenticated;
