-- Let accepted client friendships use the existing one-to-one LiveKit call
-- control plane. The original call table predates friendships, so its
-- coach_id/client_id columns act as the two stable member slots for friend
-- calls. call_relationship_kind keeps that legacy representation explicit and
-- makes every authorization recheck use the correct relationship source.

create type public.call_relationship_kind as enum ('coach_client', 'friend');

alter table public.calls
add column relationship_kind public.call_relationship_kind not null
default 'coach_client';

comment on column public.calls.relationship_kind is
  'Authorization relationship for this call. Friend calls store the lower UUID in coach_id and higher UUID in client_id for stable legacy member slots.';

create or replace function private.is_call_relationship_active(call_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case c.relationship_kind
    when 'coach_client' then exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = c.coach_id
        and cc.client_id = c.client_id
    )
    when 'friend' then
      private.are_friends(c.coach_id, c.client_id)
      and not private.is_blocked_pair(c.coach_id, c.client_id)
    else false
  end
  from public.calls c
  where c.id = call_uuid;
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
  v_recipient_role text;
  v_coach_id uuid;
  v_client_id uuid;
  v_relationship_kind public.call_relationship_kind;
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
  select role into v_recipient_role from public.profiles where id = p_recipient_id;

  if v_role = 'coach' and v_recipient_role = 'client' then
    v_coach_id := v_user_id;
    v_client_id := p_recipient_id;
    v_relationship_kind := 'coach_client';
  elsif v_role = 'client' and v_recipient_role = 'coach' then
    v_coach_id := p_recipient_id;
    v_client_id := v_user_id;
    v_relationship_kind := 'coach_client';
  elsif v_role = 'client' and v_recipient_role = 'client' then
    v_coach_id := least(v_user_id, p_recipient_id);
    v_client_id := greatest(v_user_id, p_recipient_id);
    v_relationship_kind := 'friend';
  else
    raise exception 'call not allowed';
  end if;

  if (
    v_relationship_kind = 'coach_client'
    and not exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = v_coach_id and cc.client_id = v_client_id
    )
  ) or (
    v_relationship_kind = 'friend'
    and (
      not private.are_friends(v_user_id, p_recipient_id)
      or private.is_blocked_pair(v_user_id, p_recipient_id)
    )
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
      and v_existing.relationship_kind = v_relationship_kind
      and v_existing.kind = p_kind
    then
      return v_existing;
    end if;
    raise exception 'client request id conflicts with an existing call';
  end if;

  perform 1
  from public.profiles
  where id in (v_coach_id, v_client_id)
  order by id
  for update;

  -- The relationship can change while this command waits for the pair lock.
  if (
    v_relationship_kind = 'coach_client'
    and not exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = v_coach_id and cc.client_id = v_client_id
    )
  ) or (
    v_relationship_kind = 'friend'
    and (
      not private.are_friends(v_user_id, p_recipient_id)
      or private.is_blocked_pair(v_user_id, p_recipient_id)
    )
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
      and v_existing.relationship_kind = v_relationship_kind
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
    relationship_kind,
    kind,
    provider_room_name,
    client_request_id,
    expires_at
  ) values (
    v_coach_id,
    v_client_id,
    v_user_id,
    v_relationship_kind,
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
  if not private.is_call_relationship_active(p_call_id) then
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
  if not private.is_call_relationship_active(p_call_id) then
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
