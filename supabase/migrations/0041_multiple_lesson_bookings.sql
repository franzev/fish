-- Allow a client to hold multiple future bookings. The existing exclusion
-- constraint still prevents that client from booking overlapping lessons.

create or replace function public.book_lesson_slot(p_slot_id uuid)
returns public.lesson_slots
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
  if p_slot_id is null then
    raise exception 'lesson slot is required';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_user_id
      and profile.role = 'client'
  ) then
    raise exception 'booking is only available to clients';
  end if;

  select * into v_slot
  from public.lesson_slots slot
  where slot.id = p_slot_id
  for update;

  if not found then
    raise exception 'lesson slot is unavailable';
  end if;

  -- A retry after a successful response is safe and returns the same booking.
  if v_slot.booked_by_client_id = v_user_id then
    return v_slot;
  end if;

  if v_slot.booked_by_client_id is not null
    or v_slot.starts_at <= now()
    or not exists (
      select 1
      from public.coach_clients assignment
      where assignment.client_id = v_user_id
        and assignment.coach_id = v_slot.coach_id
    )
  then
    raise exception 'lesson slot is unavailable';
  end if;

  update public.lesson_slots
  set booked_by_client_id = v_user_id,
      booked_at = now(),
      updated_at = now()
  where id = v_slot.id
  returning * into v_slot;

  return v_slot;
exception
  when exclusion_violation then
    raise exception 'lesson slot conflicts with another booking';
end;
$$;

revoke execute on function public.book_lesson_slot(uuid) from public;
grant execute on function public.book_lesson_slot(uuid) to authenticated;

-- The Edge Function reads LESSON_JOIN_WINDOW_MINUTES, validates it, and sends
-- the value into this authorization RPC so the browser and database boundary
-- use the same configured window.
drop function public.initiate_lesson_call(uuid, text);

create function public.initiate_lesson_call(
  p_lesson_slot_id uuid,
  p_client_request_id text,
  p_join_window_minutes smallint
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
  if p_join_window_minutes is null
    or p_join_window_minutes < 0
    or p_join_window_minutes > 1440
  then
    raise exception 'lesson join window is invalid';
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

  if now() < v_slot.starts_at - pg_catalog.make_interval(mins => p_join_window_minutes) then
    raise exception 'lesson call is too early';
  end if;
  if now() >= v_slot.ends_at then
    raise exception 'lesson call has ended';
  end if;

  v_recipient_id := case
    when v_user_id = v_slot.coach_id then v_slot.booked_by_client_id
    else v_slot.coach_id
  end;

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

revoke execute on function public.initiate_lesson_call(uuid, text, smallint) from public;
grant execute on function public.initiate_lesson_call(uuid, text, smallint) to authenticated;
