-- Chat schema: one assigned coach-client conversation, member-scoped reads,
-- RPC-only authenticated sends, idempotent retries, and quiet read-state rows.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete restrict,
  coach_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_client_coach_unique unique (client_id, coach_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  sender_role text not null check (sender_role in ('client', 'coach')),
  body text not null,
  client_request_id text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (char_length(btrim(body)) > 0),
  constraint messages_body_max_length check (char_length(body) <= 4000),
  constraint messages_conversation_client_request_unique unique (conversation_id, client_request_id)
);

create index messages_conversation_created_id_idx
  on public.messages (conversation_id, created_at, id);

create table public.message_reads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_message_id uuid references public.messages (id) on delete set null,
  read_at timestamptz not null default now(),
  constraint message_reads_conversation_user_unique unique (conversation_id, user_id)
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select, insert, update on public.message_reads to authenticated;
grant select, insert, update, delete on public.conversations to service_role;
grant select, insert, update, delete on public.messages to service_role;
grant select, insert, update, delete on public.message_reads to service_role;

create or replace function private.is_conversation_member(conversation_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
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

create policy "members read conversations"
  on public.conversations
  for select
  to authenticated
  using (private.is_conversation_member(id));

create policy "members read messages"
  on public.messages
  for select
  to authenticated
  using (private.is_conversation_member(conversation_id));

create policy "members read message read state"
  on public.message_reads
  for select
  to authenticated
  using (private.is_conversation_member(conversation_id));

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

  return new;
end;
$$;

create trigger enforce_message_read_integrity_trigger
  before insert or update on public.message_reads
  for each row execute function public.enforce_message_read_integrity();

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_request_id text
)
returns public.messages
language plpgsql
security definer
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
    client_request_id
  )
  values (
    p_conversation_id,
    v_sender_id,
    v_sender_role,
    p_body,
    p_client_request_id
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
    and v_existing.body = p_body
  then
    return v_existing;
  end if;

  raise exception 'client_request_id conflicts with an existing message';
end;
$$;

revoke execute on function public.send_chat_message(uuid, text, text) from public;
grant execute on function public.send_chat_message(uuid, text, text) to authenticated;
