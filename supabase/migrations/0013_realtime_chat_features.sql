-- Realtime chat feature completion: replies, edits/deletes, reactions,
-- delivered/read receipts, and durable multi-tab presence sessions.

alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists reply_to_message_id uuid references public.messages (id) on delete set null;

alter table public.messages
  drop constraint if exists messages_body_not_blank;

alter table public.messages
  add constraint messages_body_not_blank_unless_deleted
  check (deleted_at is not null or char_length(btrim(body)) > 0);

create index if not exists messages_reply_to_message_id_idx
  on public.messages (reply_to_message_id);

alter table public.message_reads
  add column if not exists last_delivered_message_id uuid references public.messages (id) on delete set null,
  add column if not exists delivered_at timestamptz;

alter table public.message_reads
  alter column read_at drop not null;

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_reactions_unique unique (message_id, user_id, emoji),
  constraint message_reactions_emoji_supported check (emoji in ('👍', '❤️', '🎉', '🙏'))
);

create index message_reactions_conversation_idx
  on public.message_reactions (conversation_id, message_id);

create table public.presence_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  active_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint presence_sessions_ended_after_start
    check (ended_at is null or ended_at >= started_at)
);

create index presence_sessions_user_heartbeat_idx
  on public.presence_sessions (user_id, last_heartbeat_at desc);

alter table public.message_reactions enable row level security;
alter table public.presence_sessions enable row level security;

grant select on public.message_reactions to authenticated;
grant select, insert, update, delete on public.message_reactions to service_role;
grant select, insert, update, delete on public.presence_sessions to authenticated;
grant select, insert, update, delete on public.presence_sessions to service_role;

create policy "members read message reactions"
  on public.message_reactions
  for select
  to authenticated
  using (
    removed_at is null
    and private.is_conversation_member(conversation_id)
  );

create policy "conversation partners read presence sessions"
  on public.presence_sessions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.conversations c
      where private.is_conversation_member(c.id)
        and presence_sessions.user_id in (c.client_id, c.coach_id)
    )
  );

create policy "users insert own presence sessions"
  on public.presence_sessions
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update own presence sessions"
  on public.presence_sessions
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users delete own presence sessions"
  on public.presence_sessions
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "members insert own message read state" on public.message_reads;
drop policy if exists "members update own message read state" on public.message_reads;

create policy "members insert own message read state"
  on public.message_reads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_conversation_member(conversation_id)
    and (
      last_read_message_id is null
      or exists (
        select 1
        from public.messages m
        where m.id = last_read_message_id
          and m.conversation_id = message_reads.conversation_id
      )
    )
    and (
      last_delivered_message_id is null
      or exists (
        select 1
        from public.messages m
        where m.id = last_delivered_message_id
          and m.conversation_id = message_reads.conversation_id
      )
    )
  );

create policy "members update own message read state"
  on public.message_reads
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_conversation_member(conversation_id)
  )
  with check (
    user_id = (select auth.uid())
    and private.is_conversation_member(conversation_id)
    and (
      last_read_message_id is null
      or exists (
        select 1
        from public.messages m
        where m.id = last_read_message_id
          and m.conversation_id = message_reads.conversation_id
      )
    )
    and (
      last_delivered_message_id is null
      or exists (
        select 1
        from public.messages m
        where m.id = last_delivered_message_id
          and m.conversation_id = message_reads.conversation_id
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
      and new.user_id in (c.client_id, c.coach_id)
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

  if new.user_id not in (v_conversation.client_id, v_conversation.coach_id) then
    raise exception 'reaction user must be a conversation member';
  end if;

  return new;
end;
$$;

create trigger enforce_message_reaction_integrity_trigger
  before insert or update on public.message_reactions
  for each row execute function public.enforce_message_reaction_integrity();

create or replace function private.later_chat_message_id(
  conversation_uuid uuid,
  current_message_uuid uuid,
  incoming_message_uuid uuid
)
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_current public.messages%rowtype;
  v_incoming public.messages%rowtype;
begin
  if incoming_message_uuid is null then
    return current_message_uuid;
  end if;

  if current_message_uuid is null then
    return incoming_message_uuid;
  end if;

  select *
  into v_current
  from public.messages
  where id = current_message_uuid
    and conversation_id = conversation_uuid;

  select *
  into v_incoming
  from public.messages
  where id = incoming_message_uuid
    and conversation_id = conversation_uuid;

  if not found then
    return current_message_uuid;
  end if;

  if v_current.created_at < v_incoming.created_at
    or (
      v_current.created_at = v_incoming.created_at
      and v_current.id < v_incoming.id
    )
  then
    return incoming_message_uuid;
  end if;

  return current_message_uuid;
end;
$$;

create or replace function private.assert_chat_message_member(message_uuid uuid)
returns public.messages
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_message public.messages%rowtype;
begin
  select m.*
  into v_message
  from public.messages m
  where m.id = message_uuid;

  if not found or not private.is_conversation_member(v_message.conversation_id) then
    raise exception 'message not found';
  end if;

  return v_message;
end;
$$;

drop function if exists public.send_chat_message(uuid, text, text);

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

  if v_sender_id not in (v_conversation.client_id, v_conversation.coach_id) then
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

create or replace function public.edit_chat_message(
  p_message_id uuid,
  p_body text
)
returns public.messages
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_sender_id uuid := (select auth.uid());
  v_message public.messages%rowtype;
begin
  if v_sender_id is null then
    raise exception 'not authenticated';
  end if;

  v_message := private.assert_chat_message_member(p_message_id);

  if v_message.sender_id <> v_sender_id then
    raise exception 'message not found';
  end if;

  if v_message.deleted_at is not null then
    raise exception 'message is deleted';
  end if;

  if p_body is null or char_length(btrim(p_body)) = 0 then
    raise exception 'message body is required';
  end if;

  if char_length(p_body) > 4000 then
    raise exception 'message body is too long';
  end if;

  update public.messages
  set body = btrim(p_body),
      edited_at = now()
  where id = p_message_id
  returning * into v_message;

  update public.conversations
  set updated_at = now()
  where id = v_message.conversation_id;

  return v_message;
end;
$$;

create or replace function public.delete_chat_message(p_message_id uuid)
returns public.messages
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_sender_id uuid := (select auth.uid());
  v_message public.messages%rowtype;
begin
  if v_sender_id is null then
    raise exception 'not authenticated';
  end if;

  v_message := private.assert_chat_message_member(p_message_id);

  if v_message.sender_id <> v_sender_id then
    raise exception 'message not found';
  end if;

  update public.messages
  set body = '',
      edited_at = null,
      deleted_at = coalesce(deleted_at, now())
  where id = p_message_id
  returning * into v_message;

  update public.conversations
  set updated_at = now()
  where id = v_message.conversation_id;

  return v_message;
end;
$$;

create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns public.messages
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_message public.messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_emoji not in ('👍', '❤️', '🎉', '🙏') then
    raise exception 'reaction is not supported';
  end if;

  v_message := private.assert_chat_message_member(p_message_id);

  if v_message.deleted_at is not null then
    raise exception 'message is deleted';
  end if;

  if exists (
    select 1
    from public.message_reactions r
    where r.message_id = p_message_id
      and r.user_id = v_user_id
      and r.emoji = p_emoji
      and r.removed_at is null
  ) then
    update public.message_reactions r
    set removed_at = now()
    where r.message_id = p_message_id
      and r.user_id = v_user_id
      and r.emoji = p_emoji
      and r.removed_at is null;
  else
    insert into public.message_reactions (
      conversation_id,
      message_id,
      user_id,
      emoji
    )
    values (
      v_message.conversation_id,
      p_message_id,
      v_user_id,
      p_emoji
    )
    on conflict (message_id, user_id, emoji)
    do update set
      conversation_id = excluded.conversation_id,
      removed_at = null,
      created_at = now();
  end if;

  return v_message;
end;
$$;

create or replace function public.mark_chat_read_state(
  p_conversation_id uuid,
  p_last_delivered_message_id uuid default null,
  p_last_read_message_id uuid default null
)
returns public.message_reads
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing public.message_reads%rowtype;
  v_read public.message_reads%rowtype;
  v_next_delivered_message_id uuid;
  v_next_read_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;

  if p_last_delivered_message_id is not null
    and not exists (
      select 1
      from public.messages m
      where m.id = p_last_delivered_message_id
        and m.conversation_id = p_conversation_id
    )
  then
    raise exception 'delivered message not found';
  end if;

  if p_last_read_message_id is not null
    and not exists (
      select 1
      from public.messages m
      where m.id = p_last_read_message_id
        and m.conversation_id = p_conversation_id
    )
  then
    raise exception 'read message not found';
  end if;

  select *
  into v_existing
  from public.message_reads
  where conversation_id = p_conversation_id
    and user_id = v_user_id
  for update;

  if found then
    v_next_delivered_message_id := private.later_chat_message_id(
      p_conversation_id,
      v_existing.last_delivered_message_id,
      p_last_delivered_message_id
    );
    v_next_read_message_id := private.later_chat_message_id(
      p_conversation_id,
      v_existing.last_read_message_id,
      p_last_read_message_id
    );

    update public.message_reads
    set last_delivered_message_id = v_next_delivered_message_id,
        delivered_at = case
          when v_next_delivered_message_id is distinct from v_existing.last_delivered_message_id
            then now()
          else v_existing.delivered_at
        end,
        last_read_message_id = v_next_read_message_id,
        read_at = case
          when v_next_read_message_id is distinct from v_existing.last_read_message_id
            then now()
          else v_existing.read_at
        end
    where id = v_existing.id
    returning * into v_read;
  else
    insert into public.message_reads (
      conversation_id,
      user_id,
      last_delivered_message_id,
      delivered_at,
      last_read_message_id,
      read_at
    )
    values (
      p_conversation_id,
      v_user_id,
      p_last_delivered_message_id,
      case when p_last_delivered_message_id is null then null else now() end,
      p_last_read_message_id,
      case when p_last_read_message_id is null then null else now() end
    )
    returning * into v_read;
  end if;

  return v_read;
end;
$$;

revoke execute on function public.send_chat_message(uuid, text, text, uuid) from public;
revoke execute on function public.edit_chat_message(uuid, text) from public;
revoke execute on function public.delete_chat_message(uuid) from public;
revoke execute on function public.toggle_message_reaction(uuid, text) from public;
revoke execute on function public.mark_chat_read_state(uuid, uuid, uuid) from public;

grant execute on function public.send_chat_message(uuid, text, text, uuid) to authenticated;
grant execute on function public.edit_chat_message(uuid, text) to authenticated;
grant execute on function public.delete_chat_message(uuid) to authenticated;
grant execute on function public.toggle_message_reaction(uuid, text) to authenticated;
grant execute on function public.mark_chat_read_state(uuid, uuid, uuid) to authenticated;

do $$
begin
  execute 'alter publication supabase_realtime add table public.message_reads';
exception
  when duplicate_object then
    null;
end;
$$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.message_reactions';
exception
  when duplicate_object then
    null;
end;
$$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.presence_sessions';
exception
  when duplicate_object then
    null;
end;
$$;
