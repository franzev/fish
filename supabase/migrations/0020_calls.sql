-- One-to-one voice call control plane. Media and WebRTC signaling stay with
-- LiveKit; Postgres owns authorization, lifecycle truth, idempotency, and
-- recovery after missed realtime events.

create type public.call_kind as enum ('audio', 'video');
create type public.call_status as enum (
  'ringing',
  'connecting',
  'active',
  'ended',
  'rejected',
  'cancelled',
  'missed',
  'failed'
);
create type public.call_end_reason as enum (
  'completed',
  'rejected',
  'caller_cancelled',
  'no_answer',
  'permission_denied',
  'connect_failed',
  'network_lost',
  'provider_error'
);
create type public.call_participant_role as enum ('host', 'invitee');
create type public.call_invitation_status as enum (
  'invited',
  'accepted',
  'rejected'
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  initiated_by uuid not null references public.profiles (id) on delete restrict,
  kind public.call_kind not null default 'audio',
  status public.call_status not null default 'ringing',
  provider text not null default 'livekit' check (provider = 'livekit'),
  provider_room_name text not null unique,
  client_request_id text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete restrict,
  end_reason public.call_end_reason,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calls_request_unique unique (initiated_by, client_request_id),
  constraint calls_distinct_members check (coach_id <> client_id),
  constraint calls_initiator_is_member check (initiated_by in (coach_id, client_id)),
  constraint calls_terminal_shape check (
    (
      status in ('ended', 'rejected', 'cancelled', 'missed', 'failed')
      and ended_at is not null
      and end_reason is not null
    )
    or (
      status in ('ringing', 'connecting', 'active')
      and ended_at is null
      and end_reason is null
    )
  ),
  constraint calls_timestamp_order check (
    (accepted_at is null or accepted_at >= created_at)
    and (connected_at is null or accepted_at is not null)
    and (connected_at is null or connected_at >= accepted_at)
    and (ended_at is null or ended_at >= created_at)
    and (ended_at is null or connected_at is null or ended_at >= connected_at)
  )
);

create index calls_coach_created_idx on public.calls (coach_id, created_at desc);
create index calls_client_created_idx on public.calls (client_id, created_at desc);
create index calls_status_expires_idx on public.calls (status, expires_at);
create index calls_initiator_created_idx on public.calls (initiated_by, created_at desc);

create table public.call_participants (
  call_id uuid not null references public.calls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.call_participant_role not null,
  invitation_status public.call_invitation_status not null,
  provider_participant_sid text,
  joined_at timestamptz,
  left_at timestamptz,
  reconnect_count integer not null default 0 check (reconnect_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (call_id, user_id),
  constraint call_participants_time_order check (
    left_at is null or (joined_at is not null and left_at >= joined_at)
  )
);

create index call_participants_user_call_idx
  on public.call_participants (user_id, call_id);

create table public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  provider_event_id text not null unique,
  event_type text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index call_events_call_occurred_idx
  on public.call_events (call_id, occurred_at, id);

alter table public.calls enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_events enable row level security;

grant select on public.calls to authenticated;
grant select on public.call_participants to authenticated;
grant select on public.call_events to authenticated;
grant select, insert, update, delete on public.calls to service_role;
grant select, insert, update, delete on public.call_participants to service_role;
grant select, insert, update, delete on public.call_events to service_role;

create or replace function private.is_call_participant(call_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.call_participants cp
    where cp.call_id = call_uuid
      and cp.user_id = (select auth.uid())
  );
$$;

create policy "participants read calls"
  on public.calls
  for select
  to authenticated
  using (private.is_call_participant(id));

create policy "participants read call participants"
  on public.call_participants
  for select
  to authenticated
  using (private.is_call_participant(call_id));

create policy "participants read call events"
  on public.call_events
  for select
  to authenticated
  using (private.is_call_participant(call_id));

create or replace function private.current_call_member(call_uuid uuid)
returns public.calls
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_call public.calls%rowtype;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_call
  from public.calls
  where id = call_uuid;

  if not found or v_user_id not in (v_call.coach_id, v_call.client_id) then
    raise exception 'call not found';
  end if;

  return v_call;
end;
$$;

create or replace function public.initiate_call(
  p_recipient_id uuid,
  p_kind public.call_kind,
  p_client_request_id text
)
returns public.calls
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_coach_id uuid;
  v_client_id uuid;
  v_existing public.calls%rowtype;
  v_call public.calls%rowtype;
  v_client_request_id text := btrim(p_client_request_id);
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_recipient_id is null or p_recipient_id = v_user_id then
    raise exception 'call not allowed';
  end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id)) = 0 then
    raise exception 'client request id is required';
  end if;
  if char_length(p_client_request_id) > 128 then
    raise exception 'client request id is too long';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role = 'coach' then
    v_coach_id := v_user_id;
    v_client_id := p_recipient_id;
  elsif v_role = 'client' then
    v_coach_id := p_recipient_id;
    v_client_id := v_user_id;
  else
    raise exception 'call not allowed';
  end if;

  if not exists (
    select 1 from public.coach_clients cc
    where cc.coach_id = v_coach_id and cc.client_id = v_client_id
  ) then
    raise exception 'call not allowed';
  end if;

  select * into v_existing
  from public.calls
  where initiated_by = v_user_id
    and client_request_id = v_client_request_id;

  if found then
    if v_existing.coach_id = v_coach_id
      and v_existing.client_id = v_client_id
      and v_existing.kind = p_kind
    then
      return v_existing;
    end if;
    raise exception 'client request id conflicts with an existing call';
  end if;

  -- Lock both identities in stable order so simultaneous cross-calls cannot
  -- both pass the busy check.
  perform 1
  from public.profiles
  where id in (v_coach_id, v_client_id)
  order by id
  for update;

  -- A concurrent retry can pass the first lookup before the original request
  -- commits. Recheck after the identity locks so idempotency wins over the
  -- busy check and unique constraint.
  select * into v_existing
  from public.calls
  where initiated_by = v_user_id
    and client_request_id = v_client_request_id;

  if found then
    if v_existing.coach_id = v_coach_id
      and v_existing.client_id = v_client_id
      and v_existing.kind = p_kind
    then
      return v_existing;
    end if;
    raise exception 'client request id conflicts with an existing call';
  end if;

  if exists (
    select 1
    from public.call_participants cp
    join public.calls c on c.id = cp.call_id
    where cp.user_id in (v_coach_id, v_client_id)
      and c.status in ('ringing', 'connecting', 'active')
  ) then
    raise exception 'participant busy';
  end if;

  if (
    select count(*)
    from public.calls
    where initiated_by = v_user_id
      and created_at >= now() - interval '5 minutes'
  ) >= 10 then
    raise exception 'call rate limited';
  end if;

  insert into public.calls (
    coach_id,
    client_id,
    initiated_by,
    kind,
    provider_room_name,
    client_request_id,
    expires_at
  ) values (
    v_coach_id,
    v_client_id,
    v_user_id,
    p_kind,
    'call_' || replace(gen_random_uuid()::text, '-', ''),
    v_client_request_id,
    now() + interval '45 seconds'
  ) returning * into v_call;

  insert into public.call_participants (
    call_id, user_id, role, invitation_status
  ) values
    (v_call.id, v_user_id, 'host', 'accepted'),
    (v_call.id, p_recipient_id, 'invitee', 'invited');

  return v_call;
end;
$$;

create or replace function public.accept_call(p_call_id uuid)
returns public.calls
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_call public.calls%rowtype;
begin
  select * into v_call from public.calls where id = p_call_id for update;
  if not found or v_user_id is null or v_user_id = v_call.initiated_by
    or v_user_id not in (v_call.coach_id, v_call.client_id)
  then
    raise exception 'call not found';
  end if;
  if not exists (
    select 1 from public.coach_clients cc
    where cc.coach_id = v_call.coach_id and cc.client_id = v_call.client_id
  ) then
    raise exception 'call not allowed';
  end if;
  if v_call.status = 'connecting' or v_call.status = 'active' then
    return v_call;
  end if;
  if v_call.status <> 'ringing' then
    raise exception 'call already finished';
  end if;
  if v_call.expires_at <= now() then
    update public.calls
    set status = 'missed', ended_at = now(), end_reason = 'no_answer', updated_at = now()
    where id = p_call_id returning * into v_call;
    return v_call;
  end if;

  update public.calls
  set status = 'connecting', accepted_at = now(), updated_at = now()
  where id = p_call_id returning * into v_call;

  update public.call_participants
  set invitation_status = 'accepted', updated_at = now()
  where call_id = p_call_id and user_id = v_user_id;

  return v_call;
end;
$$;

create or replace function public.reject_call(p_call_id uuid)
returns public.calls
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_call public.calls%rowtype;
begin
  select * into v_call from public.calls where id = p_call_id for update;
  if not found or v_user_id is null or v_user_id = v_call.initiated_by
    or v_user_id not in (v_call.coach_id, v_call.client_id)
  then
    raise exception 'call not found';
  end if;
  if v_call.status = 'rejected' then return v_call; end if;
  if v_call.status <> 'ringing' then raise exception 'call already finished'; end if;

  update public.calls
  set status = 'rejected', ended_at = now(), ended_by = v_user_id,
      end_reason = 'rejected', updated_at = now()
  where id = p_call_id returning * into v_call;
  update public.call_participants
  set invitation_status = 'rejected', updated_at = now()
  where call_id = p_call_id and user_id = v_user_id;
  return v_call;
end;
$$;

create or replace function public.cancel_call(p_call_id uuid)
returns public.calls
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_call public.calls%rowtype;
begin
  select * into v_call from public.calls where id = p_call_id for update;
  if not found or v_user_id is null or v_user_id <> v_call.initiated_by then
    raise exception 'call not found';
  end if;
  if v_call.status = 'cancelled' then return v_call; end if;
  if v_call.status <> 'ringing' then raise exception 'call already finished'; end if;

  update public.calls
  set status = 'cancelled', ended_at = now(), ended_by = v_user_id,
      end_reason = 'caller_cancelled', updated_at = now()
  where id = p_call_id returning * into v_call;
  return v_call;
end;
$$;

create or replace function public.end_call(p_call_id uuid)
returns public.calls
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_call public.calls%rowtype;
begin
  select * into v_call from public.calls where id = p_call_id for update;
  if not found or v_user_id is null
    or v_user_id not in (v_call.coach_id, v_call.client_id)
  then
    raise exception 'call not found';
  end if;
  if v_call.status = 'ended' then return v_call; end if;
  if v_call.status not in ('connecting', 'active') then
    raise exception 'call already finished';
  end if;

  update public.calls
  set status = 'ended', ended_at = now(), ended_by = v_user_id,
      end_reason = 'completed', updated_at = now()
  where id = p_call_id returning * into v_call;
  return v_call;
end;
$$;

create or replace function public.join_call(p_call_id uuid)
returns public.calls
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_call public.calls%rowtype;
begin
  v_call := private.current_call_member(p_call_id);
  if v_call.status not in ('connecting', 'active') then
    raise exception 'call already finished';
  end if;
  if not exists (
    select 1 from public.coach_clients cc
    where cc.coach_id = v_call.coach_id and cc.client_id = v_call.client_id
  ) then
    raise exception 'call not allowed';
  end if;
  if not exists (
    select 1 from public.call_participants cp
    where cp.call_id = p_call_id
      and cp.user_id = (select auth.uid())
      and cp.invitation_status = 'accepted'
  ) then
    raise exception 'call not allowed';
  end if;
  return v_call;
end;
$$;

create or replace function public.expire_stale_calls(p_now timestamptz default now())
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_count integer;
  v_connecting_count integer;
  v_disconnected_count integer;
begin
  update public.calls
  set status = 'missed', ended_at = p_now, end_reason = 'no_answer', updated_at = p_now
  where status = 'ringing' and expires_at <= p_now;
  get diagnostics v_count = row_count;
  update public.calls c
  set status = 'failed', ended_at = p_now, end_reason = 'network_lost', updated_at = p_now
  where c.status in ('connecting', 'active')
    and exists (
      select 1
      from public.call_participants cp
      where cp.call_id = c.id
        and cp.left_at is not null
        and cp.left_at <= p_now - interval '20 seconds'
    );
  get diagnostics v_disconnected_count = row_count;
  update public.calls
  set status = 'failed', ended_at = p_now, end_reason = 'connect_failed', updated_at = p_now
  where status = 'connecting'
    and accepted_at is not null
    and accepted_at <= p_now - interval '2 minutes';
  get diagnostics v_connecting_count = row_count;
  v_count := v_count + v_disconnected_count + v_connecting_count;
  return v_count;
end;
$$;

-- Reconcile one verified LiveKit event in the same database transaction as
-- its idempotency record. A failed lifecycle update rolls the event insert
-- back, allowing LiveKit's retry to repair the state instead of being skipped.
create or replace function public.reconcile_livekit_webhook(
  p_provider_event_id text,
  p_room_name text,
  p_event_type text,
  p_participant_id uuid,
  p_participant_sid text,
  p_occurred_at timestamptz
)
returns text
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_call public.calls%rowtype;
  v_event_id uuid;
  v_updated_count integer;
  v_present_count integer;
begin
  if p_provider_event_id is null or char_length(btrim(p_provider_event_id)) = 0 then
    raise exception 'provider event id is required';
  end if;
  if p_room_name is null or char_length(btrim(p_room_name)) = 0 then
    raise exception 'provider room name is required';
  end if;
  if p_event_type is null or char_length(btrim(p_event_type)) = 0 then
    raise exception 'provider event type is required';
  end if;

  select * into v_call
  from public.calls
  where provider_room_name = p_room_name
  for update;

  if not found then return 'ignored'; end if;

  insert into public.call_events (
    call_id,
    provider_event_id,
    event_type,
    actor_id,
    metadata,
    occurred_at
  ) values (
    v_call.id,
    btrim(p_provider_event_id),
    btrim(p_event_type),
    p_participant_id,
    case
      when p_participant_sid is null then '{}'::jsonb
      else jsonb_build_object('participantSid', p_participant_sid)
    end,
    p_occurred_at
  )
  on conflict (provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then return 'duplicate'; end if;

  if p_event_type = 'participant_joined'
    and p_participant_id is not null
    and p_participant_sid is not null
    and v_call.status in ('connecting', 'active')
  then
    update public.call_participants
    set provider_participant_sid = p_participant_sid,
        joined_at = coalesce(joined_at, p_occurred_at),
        left_at = null,
        reconnect_count = reconnect_count + case when joined_at is null then 0 else 1 end,
        updated_at = p_occurred_at
    where call_id = v_call.id and user_id = p_participant_id;
    get diagnostics v_updated_count = row_count;

    if v_updated_count = 1 then
      select count(*) into v_present_count
      from public.call_participants
      where call_id = v_call.id
        and joined_at is not null
        and left_at is null;

      if v_present_count >= 2 and v_call.status = 'connecting' then
        update public.calls
        set status = 'active',
            connected_at = coalesce(connected_at, p_occurred_at),
            updated_at = p_occurred_at
        where id = v_call.id and status = 'connecting';
      end if;
    end if;
  elsif p_event_type in ('participant_left', 'participant_connection_aborted')
    and p_participant_id is not null
    and p_participant_sid is not null
    and v_call.status in ('connecting', 'active')
  then
    update public.call_participants
    set provider_participant_sid = null,
        left_at = greatest(p_occurred_at, joined_at),
        updated_at = greatest(p_occurred_at, joined_at)
    where call_id = v_call.id
      and user_id = p_participant_id
      and provider_participant_sid = p_participant_sid;
  elsif p_event_type = 'room_finished'
    and v_call.status in ('ringing', 'connecting', 'active')
  then
    update public.calls
    set status = 'failed',
        ended_at = greatest(p_occurred_at, created_at),
        end_reason = 'provider_error',
        updated_at = greatest(p_occurred_at, created_at)
    where id = v_call.id and status in ('ringing', 'connecting', 'active');
  end if;

  return 'applied';
end;
$$;

revoke execute on function public.initiate_call(uuid, public.call_kind, text) from public;
revoke execute on function public.accept_call(uuid) from public;
revoke execute on function public.reject_call(uuid) from public;
revoke execute on function public.cancel_call(uuid) from public;
revoke execute on function public.end_call(uuid) from public;
revoke execute on function public.join_call(uuid) from public;
revoke execute on function public.expire_stale_calls(timestamptz) from public;
revoke execute on function public.reconcile_livekit_webhook(text, text, text, uuid, text, timestamptz) from public;
grant execute on function public.initiate_call(uuid, public.call_kind, text) to authenticated;
grant execute on function public.accept_call(uuid) to authenticated;
grant execute on function public.reject_call(uuid) to authenticated;
grant execute on function public.cancel_call(uuid) to authenticated;
grant execute on function public.end_call(uuid) to authenticated;
grant execute on function public.join_call(uuid) to authenticated;
grant execute on function public.expire_stale_calls(timestamptz) to service_role;
grant execute on function public.reconcile_livekit_webhook(text, text, text, uuid, text, timestamptz) to service_role;

-- Invitation/status wakeups. The payload contains only a call id and status;
-- clients always re-read the RLS-protected row for canonical state.
create or replace function public.broadcast_call_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'callId', new.id,
    'status', new.status,
    'occurredAt', new.updated_at
  );
  perform realtime.send(v_payload, 'call.changed', 'calls:user:' || new.coach_id::text, true);
  perform realtime.send(v_payload, 'call.changed', 'calls:user:' || new.client_id::text, true);
  return new;
end;
$$;

create trigger broadcast_call_change_trigger
  after insert or update of status on public.calls
  for each row execute function public.broadcast_call_change();

alter table realtime.messages enable row level security;
create policy "users receive own call broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'calls:user:' || (select auth.uid())::text
  );

create extension if not exists pg_cron;
select cron.schedule(
  'expire-stale-calls',
  '* * * * *',
  'select public.expire_stale_calls(now())'
);
