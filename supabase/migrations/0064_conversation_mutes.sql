-- Per-conversation quiet: one mute preference per (conversation, member).
-- The fixed durations mirror the conversation-details choices and keep
-- arbitrary expiry values out of the command boundary, the same way
-- 0048_presence_status_durations.sql handles manual presence expiry.
--
-- An absent row means notifications are on. A row with a null muted_until
-- stays quiet until the member turns it back on. Any other row expires on its
-- own at read time, so there is nothing to sweep.

create table public.conversation_mutes (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_mutes enable row level security;

-- No policies and no grants for `authenticated`: both the read and the write
-- go through the security-definer functions below, so the quiet predicate
-- lives in exactly one place instead of being re-derived on each client.
grant select, insert, update, delete on public.conversation_mutes to service_role;

create or replace function private.conversation_mute_state(
  subject_conversation_id uuid,
  subject_user_id uuid
)
returns table (
  conversation_id uuid,
  muted boolean,
  muted_until timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  -- `active` holds at most one row, and only while the quiet period is in
  -- force. Joining it onto a single anchor row means callers always get
  -- exactly one row back, and muted_until is non-null only when quiet is
  -- active with an expiry -- never a stale timestamp from an expired row.
  with active as (
    select true as muted, mute.muted_until
    from public.conversation_mutes mute
    where mute.conversation_id = subject_conversation_id
      and mute.user_id = subject_user_id
      and (mute.muted_until is null or mute.muted_until > now())
  )
  select
    subject_conversation_id,
    coalesce(active.muted, false),
    active.muted_until
  from (select 1) as anchor
  left join active on true;
$$;

create or replace function public.conversation_mute(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  muted boolean,
  muted_until timestamptz
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

  if p_conversation_id is null
    or not private.is_conversation_member(p_conversation_id)
  then
    raise exception 'conversation not found';
  end if;

  return query
    select *
    from private.conversation_mute_state(p_conversation_id, v_user_id);
end;
$$;

create or replace function public.set_conversation_mute(
  p_conversation_id uuid,
  p_muted boolean,
  p_duration_seconds integer default null
)
returns table (
  conversation_id uuid,
  muted boolean,
  muted_until timestamptz
)
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_conversation_id is null
    or p_muted is null
    or not private.is_conversation_member(p_conversation_id)
  then
    raise exception 'conversation not found';
  end if;

  if p_muted then
    if p_duration_seconds is not null
      and p_duration_seconds not in (3600, 28800, 86400)
    then
      raise exception 'quiet duration not allowed';
    end if;

    insert into public.conversation_mutes as mute (
      conversation_id,
      user_id,
      muted_until
    )
    values (
      p_conversation_id,
      v_user_id,
      case
        when p_duration_seconds is null then null
        else now() + make_interval(secs => p_duration_seconds)
      end
    )
    on conflict on constraint conversation_mutes_pkey do update
      set muted_until = excluded.muted_until,
          updated_at = now();
  else
    delete from public.conversation_mutes mute
    where mute.conversation_id = p_conversation_id
      and mute.user_id = v_user_id;
  end if;

  return query
    select *
    from private.conversation_mute_state(p_conversation_id, v_user_id);
end;
$$;

revoke execute on function public.conversation_mute(uuid) from public;
revoke execute on function public.set_conversation_mute(uuid, boolean, integer) from public;

grant execute on function public.conversation_mute(uuid) to authenticated;
grant execute on function public.set_conversation_mute(uuid, boolean, integer) to authenticated;
