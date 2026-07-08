-- Temporary community-chat demo bridge: one fixed conversation id behaves like a
-- shared room for any authenticated profile. This lets the product direction be
-- felt before introducing real room membership/assignment tables.

create or replace function private.demo_community_conversation_id()
returns uuid
language sql
immutable
set search_path = ''
as $$
  select '11111111-1111-4111-8111-111111111111'::uuid;
$$;

create or replace function private.is_demo_community_conversation(
  conversation_uuid uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select conversation_uuid = private.demo_community_conversation_id();
$$;

create or replace function private.is_conversation_member(conversation_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and private.is_demo_community_conversation(conversation_uuid)
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

create policy "demo community members read room profiles"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      id = (select auth.uid())
      or exists (
        select 1
        from public.message_reads mr
        where mr.conversation_id = private.demo_community_conversation_id()
          and mr.user_id = profiles.id
      )
    )
  );

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
        or (
          private.is_demo_community_conversation(c.id)
          and exists (
            select 1
            from public.profiles p
            where p.id = new.user_id
          )
        )
      )
  ) then
    raise exception 'message read user must be a conversation member';
  end if;

  if new.last_read_message_id is not null
    and not exists (
      select 1
      from public.messages m
      where m.id = new.last_read_message_id
        and m.conversation_id = new.conversation_id
    )
  then
    raise exception 'last_read_message_id must belong to the same conversation';
  end if;

  if new.last_delivered_message_id is not null
    and not exists (
      select 1
      from public.messages m
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
    and not (
      private.is_demo_community_conversation(v_conversation.id)
      and exists (
        select 1
        from public.profiles p
        where p.id = new.user_id
      )
    )
  then
    raise exception 'reaction user must be a conversation member';
  end if;

  return new;
end;
$$;

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_request_id text,
  p_reply_to_message_id uuid default null
)
returns public.messages
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_sender_id uuid := (select auth.uid());
  v_sender_role text;
  v_conversation public.conversations%rowtype;
  v_existing public.messages%rowtype;
  v_message public.messages%rowtype;
begin
  if v_sender_id is null then
    raise exception 'not authenticated';
  end if;

  if p_body is null or char_length(btrim(p_body)) = 0 then
    raise exception 'message body is required';
  end if;

  if char_length(p_body) > 4000 then
    raise exception 'message body is too long';
  end if;

  if p_client_request_id is null or char_length(btrim(p_client_request_id)) = 0 then
    raise exception 'client_request_id is required';
  end if;

  select c.*
  into v_conversation
  from public.conversations c
  where c.id = p_conversation_id;

  if not found or not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;

  if p_reply_to_message_id is not null
    and not exists (
      select 1
      from public.messages m
      where m.id = p_reply_to_message_id
        and m.conversation_id = p_conversation_id
        and m.deleted_at is null
    )
  then
    raise exception 'reply target not found';
  end if;

  select p.role
  into v_sender_role
  from public.profiles p
  where p.id = v_sender_id;

  if v_sender_role is null then
    raise exception 'sender profile not found';
  end if;

  if not private.is_demo_community_conversation(p_conversation_id)
    and v_sender_id not in (v_conversation.client_id, v_conversation.coach_id)
  then
    raise exception 'sender is not a conversation member';
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    sender_role,
    body,
    client_request_id,
    reply_to_message_id
  )
  values (
    p_conversation_id,
    v_sender_id,
    v_sender_role,
    btrim(p_body),
    p_client_request_id,
    p_reply_to_message_id
  )
  on conflict on constraint messages_conversation_client_request_unique do nothing
  returning * into v_message;

  if found then
    update public.conversations
    set updated_at = now()
    where id = p_conversation_id;

    return v_message;
  end if;

  select m.*
  into v_existing
  from public.messages m
  where m.conversation_id = p_conversation_id
    and m.client_request_id = p_client_request_id;

  if found
    and v_existing.sender_id = v_sender_id
    and v_existing.body = btrim(p_body)
    and v_existing.reply_to_message_id is not distinct from p_reply_to_message_id
  then
    return v_existing;
  end if;

  raise exception 'client_request_id conflicts with an existing message';
end;
$$;

revoke execute on function public.send_chat_message(uuid, text, text, uuid) from public;
grant execute on function public.send_chat_message(uuid, text, text, uuid) to authenticated;
