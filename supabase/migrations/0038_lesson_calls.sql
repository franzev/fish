-- Tie scheduled lesson calls to the booking that authorizes them. Setup checks
-- remain ephemeral LiveKit rooms and never create a calls row.

alter table public.calls
  add column lesson_slot_id uuid references public.lesson_slots (id) on delete set null;

create unique index calls_live_lesson_idx
  on public.calls (lesson_slot_id)
  where lesson_slot_id is not null
    and status in ('ringing', 'connecting', 'active');

comment on column public.calls.lesson_slot_id is
  'Booked lesson that authorized this scheduled call. Null for ad-hoc calls.';

create table private.lesson_media_check_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_slot_id uuid not null references public.lesson_slots (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index lesson_media_check_attempts_user_created_idx
  on private.lesson_media_check_attempts (user_id, created_at desc);

create or replace function public.authorize_lesson_media_check(
  p_lesson_slot_id uuid
)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_slot public.lesson_slots%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_slot
  from public.lesson_slots slot
  where slot.id = p_lesson_slot_id
  for share;

  if not found
    or v_slot.booked_by_client_id is null
    or v_user_id not in (v_slot.coach_id, v_slot.booked_by_client_id)
  then
    raise exception 'media check not allowed';
  end if;
  if now() >= v_slot.ends_at then
    raise exception 'media check has ended';
  end if;

  -- Serialize attempts for one user so concurrent Edge requests cannot skip
  -- the shared database limit by racing separate function isolates.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  delete from private.lesson_media_check_attempts
  where user_id = v_user_id
    and created_at < now() - interval '5 minutes';

  if (
    select count(*)
    from private.lesson_media_check_attempts
    where user_id = v_user_id
  ) >= 10 then
    raise exception 'media check rate limited';
  end if;

  insert into private.lesson_media_check_attempts (user_id, lesson_slot_id)
  values (v_user_id, p_lesson_slot_id);
end;
$$;

revoke execute on function public.authorize_lesson_media_check(uuid) from public;
grant execute on function public.authorize_lesson_media_check(uuid) to authenticated;

create or replace function public.initiate_lesson_call(
  p_lesson_slot_id uuid,
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
  v_slot public.lesson_slots%rowtype;
  v_recipient_id uuid;
  v_call public.calls%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_lesson_slot_id is null then
    raise exception 'lesson slot is required';
  end if;

  select * into v_slot
  from public.lesson_slots slot
  where slot.id = p_lesson_slot_id
  for share;

  if not found
    or v_slot.booked_by_client_id is null
    or v_user_id not in (v_slot.coach_id, v_slot.booked_by_client_id)
  then
    raise exception 'lesson call not allowed';
  end if;

  if now() < v_slot.starts_at - interval '10 minutes' then
    raise exception 'lesson call is too early';
  end if;
  if now() >= v_slot.ends_at then
    raise exception 'lesson call has ended';
  end if;

  v_recipient_id := case
    when v_user_id = v_slot.coach_id then v_slot.booked_by_client_id
    else v_slot.coach_id
  end;

  -- Reuse the hardened ad-hoc lifecycle for identity locks, busy checks,
  -- rate limiting, idempotency, participant rows, and realtime delivery.
  v_call := public.initiate_call(
    v_recipient_id,
    'video'::public.call_kind,
    p_client_request_id
  );

  if v_call.lesson_slot_id is not null
    and v_call.lesson_slot_id <> p_lesson_slot_id
  then
    raise exception 'client request id conflicts with another lesson';
  end if;

  update public.calls
  set lesson_slot_id = p_lesson_slot_id,
      updated_at = now()
  where id = v_call.id
  returning * into v_call;

  return v_call;
end;
$$;

revoke execute on function public.initiate_lesson_call(uuid, text) from public;
grant execute on function public.initiate_lesson_call(uuid, text) to authenticated;
