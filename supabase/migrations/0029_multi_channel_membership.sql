-- Promote channels from a naming layer over one demo conversation to real
-- membership-backed shared rooms. Direct coach/client conversations keep the
-- same authorization rules.

create or replace function private.is_conversation_member(conversation_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.channels c
    join public.channel_members cm on cm.channel_id = c.id
    where c.conversation_id = conversation_uuid
      and cm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_uuid
      and (
        (
          c.client_id = (select auth.uid())
          and private.is_client_of(c.coach_id)
        )
        or (
          c.coach_id = (select auth.uid())
          and private.is_coach_of(c.client_id)
        )
      )
  );
$$;

create or replace function private.shares_channel_with(profile_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.channel_members viewer
    join public.channel_members subject
      on subject.channel_id = viewer.channel_id
    where viewer.user_id = (select auth.uid())
      and subject.user_id = profile_uuid
  );
$$;

create policy "channel members read shared profiles"
  on public.profiles
  for select
  to authenticated
  using (private.shares_channel_with(id));

create or replace function public.enforce_message_read_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id = new.conversation_id
      and (
        new.user_id in (c.client_id, c.coach_id)
        or exists (
          select 1
          from public.channels channel
          join public.channel_members member on member.channel_id = channel.id
          where channel.conversation_id = c.id
            and member.user_id = new.user_id
        )
      )
  ) then
    raise exception 'message read user must be a conversation member';
  end if;

  if new.last_read_message_id is not null
    and not exists (
      select 1 from public.messages m
      where m.id = new.last_read_message_id
        and m.conversation_id = new.conversation_id
    )
  then
    raise exception 'last_read_message_id must belong to the same conversation';
  end if;

  if new.last_delivered_message_id is not null
    and not exists (
      select 1 from public.messages m
      where m.id = new.last_delivered_message_id
        and m.conversation_id = new.conversation_id
    )
  then
    raise exception 'last_delivered_message_id must belong to the same conversation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_message_reaction_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
begin
  select c.*
  into v_conversation
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  where m.id = new.message_id
    and c.id = new.conversation_id;

  if not found then
    raise exception 'reaction message must belong to the same conversation';
  end if;

  if new.user_id not in (v_conversation.client_id, v_conversation.coach_id)
    and not exists (
      select 1
      from public.channels channel
      join public.channel_members member on member.channel_id = channel.id
      where channel.conversation_id = v_conversation.id
        and member.user_id = new.user_id
    )
  then
    raise exception 'reaction user must be a conversation member';
  end if;

  return new;
end;
$$;
