-- Client-to-client friendships: requests, accepted friendships, blocks, and
-- durable in-app notifications. Postgres owns authorization, lifecycle truth,
-- idempotency, and pair serialization; the friend-command edge function only
-- validates input and maps errors. Coaches stay connected via coach_clients.

create type public.friend_request_status as enum (
  'pending',
  'accepted',
  'declined',
  'cancelled'
);
create type public.friend_notification_kind as enum (
  'friend_request_received',
  'friend_request_accepted'
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  pair_low_id uuid not null generated always as (least(sender_id, recipient_id)) stored,
  pair_high_id uuid not null generated always as (greatest(sender_id, recipient_id)) stored,
  status public.friend_request_status not null default 'pending',
  client_request_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_distinct_members check (sender_id <> recipient_id),
  constraint friend_requests_request_unique unique (sender_id, client_request_id),
  constraint friend_requests_resolved_shape check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

-- One live request per unordered pair, in either direction. Crossed or
-- duplicate sends lose to this index inside the serialized RPCs.
create unique index friend_requests_pending_pair_idx
  on public.friend_requests (pair_low_id, pair_high_id)
  where status = 'pending';
create index friend_requests_recipient_pending_idx
  on public.friend_requests (recipient_id, created_at desc)
  where status = 'pending';
create index friend_requests_sender_created_idx
  on public.friend_requests (sender_id, created_at desc);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.profiles (id) on delete cascade,
  user_high_id uuid not null references public.profiles (id) on delete cascade,
  created_by_request_id uuid references public.friend_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Strict ordering both canonicalizes the pair and forbids self-friendship.
  constraint friendships_pair_order check (user_low_id < user_high_id),
  constraint friendships_pair_unique unique (user_low_id, user_high_id)
);

create index friendships_high_member_idx on public.friendships (user_high_id);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_distinct_members check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- Durable notification pointers only. Display names and copy are hydrated
-- from current profile data at read time, never stored.
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind public.friend_notification_kind not null,
  entity_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_entity_unique unique (recipient_id, kind, entity_id)
);

create index user_notifications_recipient_created_idx
  on public.user_notifications (recipient_id, created_at desc);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_notifications enable row level security;

grant select on public.friend_requests to authenticated;
grant select on public.friendships to authenticated;
grant select on public.user_blocks to authenticated;
grant select on public.user_notifications to authenticated;
grant select, insert, update, delete on public.friend_requests to service_role;
grant select, insert, update, delete on public.friendships to service_role;
grant select, insert, update, delete on public.user_blocks to service_role;
grant select, insert, update, delete on public.user_notifications to service_role;

-- Declined requests stay invisible to the sender so a decline never shows up
-- as a state change on their side; the pending marker just goes away.
create policy "senders read own undeclined friend requests"
  on public.friend_requests
  for select
  to authenticated
  using (sender_id = (select auth.uid()) and status <> 'declined');

create policy "recipients read own friend requests"
  on public.friend_requests
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "members read own friendships"
  on public.friendships
  for select
  to authenticated
  using ((select auth.uid()) in (user_low_id, user_high_id));

create policy "blockers read own blocks"
  on public.user_blocks
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "recipients read own notifications"
  on public.user_notifications
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.user_low_id = least(a, b)
      and f.user_high_id = greatest(a, b)
  );
$$;

create or replace function private.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b)
      or (ub.blocker_id = b and ub.blocked_id = a)
  );
$$;

-- Serializes every relationship mutation for one unordered pair by locking
-- both profile rows in stable order (the calls pattern). Concurrent send,
-- accept, and block for the same pair queue behind these locks, so their
-- rechecks always see committed truth.
create or replace function private.lock_friend_pair(a uuid, b uuid)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id in (a, b)
  order by id
  for update;
end;
$$;

-- The caller must be a signed-in client for every friend surface.
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
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'client' then
    raise exception 'friends not available';
  end if;
  return v_user_id;
end;
$$;

-- Exact-username lookup returning only safe profile fields plus the current
-- relationship state. Self, coaches, blocked pairs, unknown handles, and
-- decline-cooldown targets all collapse into the same 'unavailable' answer.
create or replace function public.search_friend_candidate(p_username text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
  v_username text := lower(btrim(replace(coalesce(p_username, ''), '@', '')));
  v_profile public.profiles%rowtype;
  v_request public.friend_requests%rowtype;
begin
  if v_username !~ '^[a-z0-9_]{3,64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select * into v_profile from public.profiles where username = v_username;
  if not found
    or v_profile.id = v_user_id
    or v_profile.role <> 'client'
    or private.is_blocked_pair(v_user_id, v_profile.id)
  then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if private.are_friends(v_user_id, v_profile.id) then
    return jsonb_build_object(
      'status', 'friends',
      'profile', jsonb_build_object(
        'id', v_profile.id,
        'display_name', v_profile.display_name,
        'username', v_profile.username
      )
    );
  end if;

  select * into v_request
  from public.friend_requests fr
  where fr.pair_low_id = least(v_user_id, v_profile.id)
    and fr.pair_high_id = greatest(v_user_id, v_profile.id)
    and fr.status = 'pending';

  if found then
    return jsonb_build_object(
      'status',
      case when v_request.sender_id = v_user_id
        then 'outgoing_pending' else 'incoming_pending' end,
      'request_id', v_request.id,
      'profile', jsonb_build_object(
        'id', v_profile.id,
        'display_name', v_profile.display_name,
        'username', v_profile.username
      )
    );
  end if;

  -- A recent decline keeps the target unavailable to the declined sender so
  -- repeat requests cannot become pressure.
  if exists (
    select 1
    from public.friend_requests fr
    where fr.sender_id = v_user_id
      and fr.recipient_id = v_profile.id
      and fr.status = 'declined'
      and fr.responded_at > now() - interval '7 days'
  ) then
    return jsonb_build_object('status', 'unavailable');
  end if;

  return jsonb_build_object(
    'status', 'none',
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'username', v_profile.username
    )
  );
end;
$$;

create or replace function public.list_friends(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  friendship_id uuid,
  friend_id uuid,
  display_name text,
  username text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
begin
  return query
  select
    f.id,
    p.id,
    p.display_name,
    p.username,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_low_id = v_user_id then f.user_high_id else f.user_low_id end
  where v_user_id in (f.user_low_id, f.user_high_id)
    and (
      p_cursor_created_at is null
      or (f.created_at, f.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by f.created_at desc, f.id desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.list_incoming_friend_requests()
returns table (
  request_id uuid,
  sender_id uuid,
  display_name text,
  username text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
begin
  return query
  select fr.id, p.id, p.display_name, p.username, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.sender_id
  where fr.recipient_id = v_user_id
    and fr.status = 'pending'
  order by fr.created_at desc, fr.id desc
  limit 100;
end;
$$;

create or replace function public.list_friend_notifications(p_limit integer default 50)
returns table (
  id uuid,
  kind public.friend_notification_kind,
  actor_id uuid,
  actor_display_name text,
  actor_username text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
begin
  return query
  select n.id, n.kind, p.id, p.display_name, p.username, n.entity_id, n.read_at, n.created_at
  from public.user_notifications n
  join public.profiles p on p.id = n.actor_id
  where n.recipient_id = v_user_id
  order by n.created_at desc, n.id desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.send_friend_request(
  p_target_id uuid,
  p_client_request_id text
)
returns public.friend_requests
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
  v_target public.profiles%rowtype;
  v_existing public.friend_requests%rowtype;
  v_request public.friend_requests%rowtype;
  v_client_request_id text := btrim(coalesce(p_client_request_id, ''));
begin
  if p_target_id is null or p_target_id = v_user_id then
    raise exception 'person unavailable';
  end if;
  if char_length(v_client_request_id) = 0 then
    raise exception 'client request id is required';
  end if;
  if char_length(v_client_request_id) > 128 then
    raise exception 'client request id is too long';
  end if;

  -- Fast idempotent path before any locks: a duplicate click or retry
  -- returns the request it already created.
  select * into v_existing
  from public.friend_requests
  where sender_id = v_user_id and client_request_id = v_client_request_id;
  if found then
    if v_existing.recipient_id = p_target_id then
      return v_existing;
    end if;
    raise exception 'client request id conflicts with an existing friend request';
  end if;

  perform private.lock_friend_pair(v_user_id, p_target_id);

  -- Recheck after the pair locks so idempotency wins over the state checks
  -- and the unique constraints.
  select * into v_existing
  from public.friend_requests
  where sender_id = v_user_id and client_request_id = v_client_request_id;
  if found then
    if v_existing.recipient_id = p_target_id then
      return v_existing;
    end if;
    raise exception 'client request id conflicts with an existing friend request';
  end if;

  select * into v_target from public.profiles where id = p_target_id;
  if not found or v_target.role <> 'client'
    or private.is_blocked_pair(v_user_id, p_target_id)
  then
    raise exception 'person unavailable';
  end if;

  if private.are_friends(v_user_id, p_target_id) then
    raise exception 'already friends';
  end if;

  select * into v_existing
  from public.friend_requests fr
  where fr.pair_low_id = least(v_user_id, p_target_id)
    and fr.pair_high_id = greatest(v_user_id, p_target_id)
    and fr.status = 'pending';
  if found then
    if v_existing.sender_id = v_user_id then
      raise exception 'request pending';
    end if;
    -- Crossed requests never auto-accept; the sender is guided to review
    -- the request that is already waiting for them.
    raise exception 'incoming request exists';
  end if;

  if exists (
    select 1
    from public.friend_requests fr
    where fr.sender_id = v_user_id
      and fr.recipient_id = p_target_id
      and fr.status = 'declined'
      and fr.responded_at > now() - interval '7 days'
  ) then
    raise exception 'person unavailable';
  end if;

  if (
    select count(*)
    from public.friend_requests
    where sender_id = v_user_id and status = 'pending'
  ) >= 25 then
    raise exception 'friend request rate limited';
  end if;

  if (
    select count(*)
    from public.friend_requests
    where sender_id = v_user_id
      and created_at >= now() - interval '5 minutes'
  ) >= 10 then
    raise exception 'friend request rate limited';
  end if;

  insert into public.friend_requests (sender_id, recipient_id, client_request_id)
  values (v_user_id, p_target_id, v_client_request_id)
  returning * into v_request;

  insert into public.user_notifications (recipient_id, actor_id, kind, entity_id)
  values (p_target_id, v_user_id, 'friend_request_received', v_request.id)
  on conflict on constraint user_notifications_entity_unique do nothing;

  return v_request;
end;
$$;

create or replace function public.respond_friend_request(
  p_request_id uuid,
  p_response text
)
returns public.friend_requests
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
  v_request public.friend_requests%rowtype;
begin
  if p_response not in ('accept', 'decline') then
    raise exception 'response must be accept or decline';
  end if;

  select * into v_request from public.friend_requests where id = p_request_id;
  if not found or v_request.recipient_id <> v_user_id then
    raise exception 'request not found';
  end if;

  perform private.lock_friend_pair(v_request.sender_id, v_request.recipient_id);

  select * into v_request from public.friend_requests where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if v_request.status <> 'pending' then
    -- A retry of the response that already won is idempotent; anything else
    -- reports the request as resolved without changing data.
    if (v_request.status = 'accepted' and p_response = 'accept')
      or (v_request.status = 'declined' and p_response = 'decline')
    then
      return v_request;
    end if;
    raise exception 'request already resolved';
  end if;

  -- A block that raced in wins: resolve the request quietly.
  if private.is_blocked_pair(v_request.sender_id, v_request.recipient_id) then
    raise exception 'request not found';
  end if;

  if p_response = 'decline' then
    update public.friend_requests
    set status = 'declined', responded_at = now(), updated_at = now()
    where id = p_request_id
    returning * into v_request;

    delete from public.user_notifications
    where kind = 'friend_request_received' and entity_id = p_request_id;

    return v_request;
  end if;

  update public.friend_requests
  set status = 'accepted', responded_at = now(), updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.friendships (user_low_id, user_high_id, created_by_request_id)
  values (
    least(v_request.sender_id, v_request.recipient_id),
    greatest(v_request.sender_id, v_request.recipient_id),
    v_request.id
  )
  on conflict on constraint friendships_pair_unique do nothing;

  delete from public.user_notifications
  where kind = 'friend_request_received' and entity_id = p_request_id;

  insert into public.user_notifications (recipient_id, actor_id, kind, entity_id)
  values (v_request.sender_id, v_request.recipient_id, 'friend_request_accepted', v_request.id)
  on conflict on constraint user_notifications_entity_unique do nothing;

  return v_request;
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns public.friend_requests
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
  v_request public.friend_requests%rowtype;
begin
  select * into v_request from public.friend_requests where id = p_request_id;
  if not found or v_request.sender_id <> v_user_id then
    raise exception 'request not found';
  end if;

  perform private.lock_friend_pair(v_request.sender_id, v_request.recipient_id);

  select * into v_request from public.friend_requests where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if v_request.status = 'cancelled' then
    return v_request;
  end if;
  if v_request.status <> 'pending' then
    raise exception 'request already resolved';
  end if;

  update public.friend_requests
  set status = 'cancelled', responded_at = now(), updated_at = now()
  where id = p_request_id
  returning * into v_request;

  delete from public.user_notifications
  where kind = 'friend_request_received' and entity_id = p_request_id;

  return v_request;
end;
$$;

create or replace function public.remove_friend(p_target_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
  v_removed boolean;
begin
  if p_target_id is null or p_target_id = v_user_id then
    raise exception 'person unavailable';
  end if;

  perform private.lock_friend_pair(v_user_id, p_target_id);

  delete from public.friendships
  where user_low_id = least(v_user_id, p_target_id)
    and user_high_id = greatest(v_user_id, p_target_id);
  v_removed := found;

  return v_removed;
end;
$$;

create or replace function public.block_user(p_target_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
begin
  if p_target_id is null or p_target_id = v_user_id then
    raise exception 'person unavailable';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'person unavailable';
  end if;

  perform private.lock_friend_pair(v_user_id, p_target_id);

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_user_id, p_target_id)
  on conflict (blocker_id, blocked_id) do nothing;

  -- The block wins over anything in flight for the pair: requests resolve,
  -- the friendship goes away, and stale notifications disappear on both
  -- sides. The blocked person is never notified: their own pending request
  -- resolves as declined, which sender RLS hides and the broadcast trigger
  -- keeps off their topic, so the block never surfaces as a state change.
  update public.friend_requests
  set status = 'declined', responded_at = now(), updated_at = now()
  where sender_id = p_target_id
    and recipient_id = v_user_id
    and status = 'pending';

  -- The blocker's own outgoing request resolves like an ordinary cancel.
  update public.friend_requests
  set status = 'cancelled', responded_at = now(), updated_at = now()
  where sender_id = v_user_id
    and recipient_id = p_target_id
    and status = 'pending';

  delete from public.friendships
  where user_low_id = least(v_user_id, p_target_id)
    and user_high_id = greatest(v_user_id, p_target_id);

  delete from public.user_notifications
  where (recipient_id = v_user_id and actor_id = p_target_id)
    or (recipient_id = p_target_id and actor_id = v_user_id);

  return true;
end;
$$;

create or replace function public.unblock_user(p_target_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
begin
  if p_target_id is null then
    raise exception 'person unavailable';
  end if;

  -- Unblocking never restores an old friendship or request.
  delete from public.user_blocks
  where blocker_id = v_user_id and blocked_id = p_target_id;

  return found;
end;
$$;

create or replace function public.mark_friend_notifications_read(
  p_notification_ids uuid[]
)
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
  v_count integer;
begin
  update public.user_notifications
  set read_at = now()
  where recipient_id = v_user_id
    and id = any(coalesce(p_notification_ids, '{}'::uuid[]))
    and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.search_friend_candidate(text) from public;
revoke execute on function public.list_friends(timestamptz, uuid, integer) from public;
revoke execute on function public.list_incoming_friend_requests() from public;
revoke execute on function public.list_friend_notifications(integer) from public;
revoke execute on function public.send_friend_request(uuid, text) from public;
revoke execute on function public.respond_friend_request(uuid, text) from public;
revoke execute on function public.cancel_friend_request(uuid) from public;
revoke execute on function public.remove_friend(uuid) from public;
revoke execute on function public.block_user(uuid) from public;
revoke execute on function public.unblock_user(uuid) from public;
revoke execute on function public.mark_friend_notifications_read(uuid[]) from public;
grant execute on function public.search_friend_candidate(text) to authenticated;
grant execute on function public.list_friends(timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_incoming_friend_requests() to authenticated;
grant execute on function public.list_friend_notifications(integer) to authenticated;
grant execute on function public.send_friend_request(uuid, text) to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.mark_friend_notifications_read(uuid[]) to authenticated;

-- Wake-up hints only. The payload carries ids and a reason; clients always
-- refetch RLS-protected state through the list RPCs for canonical truth.
create or replace function public.broadcast_friend_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'requestId', new.id,
    'reason', case when tg_op = 'INSERT'
      then 'request_created' else 'request_' || new.status end,
    'occurredAt', new.updated_at
  );
  -- A decline (including a block resolving the blocked person's request)
  -- must never surface on the sender's side; only the recipient's devices
  -- get that wake-up.
  if tg_op = 'INSERT' or new.status <> 'declined' then
    perform realtime.send(v_payload, 'friends.changed', 'friends:user:' || new.sender_id::text, true);
  end if;
  perform realtime.send(v_payload, 'friends.changed', 'friends:user:' || new.recipient_id::text, true);
  return new;
end;
$$;

create trigger broadcast_friend_request_change_trigger
  after insert or update of status on public.friend_requests
  for each row execute function public.broadcast_friend_request_change();

create or replace function public.broadcast_friendship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.friendships%rowtype;
  v_payload jsonb;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  v_payload := jsonb_build_object(
    'friendshipId', v_row.id,
    'reason', case when tg_op = 'DELETE'
      then 'friendship_removed' else 'friendship_created' end,
    'occurredAt', now()
  );
  perform realtime.send(v_payload, 'friends.changed', 'friends:user:' || v_row.user_low_id::text, true);
  perform realtime.send(v_payload, 'friends.changed', 'friends:user:' || v_row.user_high_id::text, true);
  return v_row;
end;
$$;

create trigger broadcast_friendship_change_trigger
  after insert or delete on public.friendships
  for each row execute function public.broadcast_friendship_change();

create policy "users receive own friend broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'friends:user:' || (select auth.uid())::text
  );
