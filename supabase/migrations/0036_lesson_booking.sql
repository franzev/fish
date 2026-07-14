-- Single-lesson booking MVP. A row begins as published coach availability and
-- becomes the durable booking when booked_by_client_id is set. This keeps the
-- model small while the command RPC provides race-safe, idempotent booking.

create extension if not exists btree_gist with schema extensions;

create table public.lesson_slots (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes smallint not null default 50 check (duration_minutes = 50),
  booked_by_client_id uuid references public.profiles (id) on delete restrict,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_slots_time_order check (ends_at = starts_at + interval '50 minutes'),
  constraint lesson_slots_booking_shape check (
    (booked_by_client_id is null and booked_at is null)
    or (booked_by_client_id is not null and booked_at is not null)
  ),
  constraint lesson_slots_coach_start_unique unique (coach_id, starts_at),
  constraint lesson_slots_coach_overlap exclude using gist (
    coach_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

alter table public.lesson_slots
  add constraint lesson_slots_client_overlap exclude using gist (
    booked_by_client_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (booked_by_client_id is not null);

create index lesson_slots_available_idx
  on public.lesson_slots (coach_id, starts_at)
  where booked_by_client_id is null;

create index lesson_slots_client_upcoming_idx
  on public.lesson_slots (booked_by_client_id, ends_at)
  where booked_by_client_id is not null;

alter table public.lesson_slots enable row level security;

grant select on public.lesson_slots to authenticated;
grant select, insert, update, delete on public.lesson_slots to service_role;

create policy "coaches read own lesson slots"
  on public.lesson_slots
  for select
  to authenticated
  using (coach_id = (select auth.uid()));

create policy "clients read available or booked lesson slots"
  on public.lesson_slots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'client'
    )
    and (
      booked_by_client_id = (select auth.uid())
      or (
        booked_by_client_id is null
        and starts_at > now()
        and exists (
          select 1
          from public.coach_clients assignment
          where assignment.client_id = (select auth.uid())
            and assignment.coach_id = lesson_slots.coach_id
        )
      )
    )
  );

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

  if exists (
    select 1
    from public.lesson_slots booked
    where booked.booked_by_client_id = v_user_id
      and booked.ends_at > now()
  ) then
    raise exception 'an upcoming lesson is already booked';
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
