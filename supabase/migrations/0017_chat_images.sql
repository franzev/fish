-- Private, processed image attachments for chat messages.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null default 'image' check (kind = 'image'),
  status text not null default 'pending'
    check (status in ('pending', 'uploaded', 'processing', 'ready', 'failed', 'cancelled')),
  client_upload_id text not null,
  position integer check (position is null or position between 0 and 4),
  staging_path text not null unique,
  display_path text unique,
  thumbnail_path text unique,
  original_name text not null,
  source_mime_type text not null,
  stored_mime_type text,
  source_byte_size bigint not null check (source_byte_size between 1 and 10485760),
  stored_byte_size bigint check (stored_byte_size is null or stored_byte_size between 1 and 5242880),
  width integer check (width is null or width between 1 and 4096),
  height integer check (height is null or height between 1 and 4096),
  failure_code text,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_attachments_uploader_request_unique unique (uploader_id, client_upload_id),
  constraint message_attachments_ready_fields check (
    status <> 'ready'
    or (display_path is not null and thumbnail_path is not null and stored_mime_type = 'image/webp'
        and stored_byte_size is not null and width is not null and height is not null)
  ),
  constraint message_attachments_bound_ready check (
    message_id is null or (status = 'ready' and position is not null)
  )
);

create index message_attachments_message_id_idx on public.message_attachments (message_id);
create index message_attachments_conversation_created_idx
  on public.message_attachments (conversation_id, created_at);
create index message_attachments_status_expires_idx
  on public.message_attachments (status, expires_at);

alter table public.message_attachments enable row level security;
grant select on public.message_attachments to authenticated;
grant select, insert, update, delete on public.message_attachments to service_role;

create policy "members read ready message attachments"
  on public.message_attachments for select to authenticated
  using (
    (uploader_id = (select auth.uid()) and message_id is null)
    or (
      status = 'ready'
      and message_id is not null
      and private.is_conversation_member(conversation_id)
      and exists (
        select 1 from public.messages m
        where m.id = message_attachments.message_id and m.deleted_at is null
      )
    )
  );

create policy "members read private chat image objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1
      from public.message_attachments a
      where name in (a.staging_path, a.display_path, a.thumbnail_path)
        and (
          (a.uploader_id = (select auth.uid()) and a.message_id is null)
          or (
            a.status = 'ready'
            and a.message_id is not null
            and private.is_conversation_member(a.conversation_id)
            and exists (
              select 1 from public.messages m
              where m.id = a.message_id and m.deleted_at is null
            )
          )
        )
    )
  );

create or replace function public.initialize_chat_image_upload(
  p_conversation_id uuid,
  p_client_upload_id text,
  p_original_name text,
  p_source_mime_type text,
  p_source_byte_size bigint
)
returns public.message_attachments
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_attachment public.message_attachments%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;
  if p_client_upload_id is null or char_length(btrim(p_client_upload_id)) not between 1 and 120 then
    raise exception 'client upload id is required';
  end if;
  if p_original_name is null or char_length(btrim(p_original_name)) not between 1 and 255 then
    raise exception 'image name is invalid';
  end if;
  if p_source_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'image type is not supported';
  end if;
  if p_source_byte_size not between 1 and 10485760 then
    raise exception 'image is too large';
  end if;
  if (select count(*) from public.message_attachments
      where uploader_id = v_user_id and created_at > now() - interval '10 minutes') >= 20
    or (select count(*) from public.message_attachments
        where uploader_id = v_user_id and created_at > now() - interval '1 day') >= 100
  then
    raise exception 'image upload rate limit reached';
  end if;

  select * into v_attachment from public.message_attachments
  where uploader_id = v_user_id and client_upload_id = p_client_upload_id;
  if found then
    if v_attachment.conversation_id = p_conversation_id
      and v_attachment.original_name = btrim(p_original_name)
      and v_attachment.source_mime_type = p_source_mime_type
      and v_attachment.source_byte_size = p_source_byte_size
    then return v_attachment; end if;
    raise exception 'client upload id conflicts with an existing image';
  end if;

  insert into public.message_attachments (
    id, conversation_id, uploader_id, client_upload_id, staging_path,
    original_name, source_mime_type, source_byte_size
  ) values (
    v_id, p_conversation_id, v_user_id, btrim(p_client_upload_id),
    p_conversation_id::text || '/' || v_id::text || '/staging.webp',
    btrim(p_original_name), p_source_mime_type, p_source_byte_size
  ) returning * into v_attachment;
  return v_attachment;
end;
$$;

grant execute on function public.initialize_chat_image_upload(uuid, text, text, text, bigint)
  to authenticated;

-- Image-only messages are validated by send_chat_message, where attachment rows
-- can be locked and checked in the same transaction.
alter table public.messages drop constraint if exists messages_body_not_blank_unless_deleted;
alter table public.messages alter column body set default '';

drop function if exists public.send_chat_message(uuid, text, text, uuid);

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_request_id text,
  p_reply_to_message_id uuid default null,
  p_attachment_ids uuid[] default '{}'::uuid[]
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
  v_attachment_count integer;
  v_existing_attachment_ids uuid[];
begin
  if v_sender_id is null then raise exception 'not authenticated'; end if;
  p_body := btrim(coalesce(p_body, ''));
  p_attachment_ids := coalesce(p_attachment_ids, '{}'::uuid[]);
  if char_length(p_body) > 4000 then raise exception 'message body is too long'; end if;
  if cardinality(p_attachment_ids) > 5 then raise exception 'too many images'; end if;
  if char_length(p_body) = 0 and cardinality(p_attachment_ids) = 0 then
    raise exception 'message content is required';
  end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id)) = 0 then
    raise exception 'client_request_id is required';
  end if;
  if cardinality(p_attachment_ids) <> (
    select count(distinct attachment_id) from unnest(p_attachment_ids) attachment_id
  ) then raise exception 'duplicate image'; end if;

  select * into v_conversation from public.conversations where id = p_conversation_id;
  if not found or not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from public.messages m where m.id = p_reply_to_message_id
      and m.conversation_id = p_conversation_id and m.deleted_at is null
  ) then raise exception 'reply target not found'; end if;
  select role into v_sender_role from public.profiles where id = v_sender_id;
  if v_sender_role is null then raise exception 'sender profile not found'; end if;

  select * into v_existing from public.messages m
  where m.conversation_id = p_conversation_id and m.client_request_id = btrim(p_client_request_id);
  if found then
    select coalesce(array_agg(a.id order by a.position), '{}'::uuid[])
      into v_existing_attachment_ids from public.message_attachments a where a.message_id = v_existing.id;
    if v_existing.sender_id = v_sender_id and v_existing.body = p_body
      and v_existing.reply_to_message_id is not distinct from p_reply_to_message_id
      and v_existing_attachment_ids = p_attachment_ids
    then return v_existing; end if;
    raise exception 'client_request_id conflicts with an existing message';
  end if;

  if cardinality(p_attachment_ids) > 0 then
    perform 1 from public.message_attachments a
      where a.id = any(p_attachment_ids) for update;
    select count(*) into v_attachment_count
    from public.message_attachments a
    where a.id = any(p_attachment_ids) and a.conversation_id = p_conversation_id
      and a.uploader_id = v_sender_id and a.status = 'ready' and a.message_id is null
      and a.expires_at > now();
    if v_attachment_count <> cardinality(p_attachment_ids) then
      raise exception 'image attachment is not ready';
    end if;
  end if;

  insert into public.messages (
    conversation_id, sender_id, sender_role, body, client_request_id, reply_to_message_id
  ) values (
    p_conversation_id, v_sender_id, v_sender_role, p_body,
    btrim(p_client_request_id), p_reply_to_message_id
  ) on conflict on constraint messages_conversation_client_request_unique do nothing
  returning * into v_message;

  if found then
    update public.message_attachments a
    set message_id = v_message.id, position = ordered.ordinality - 1, updated_at = now(),
        expires_at = now() + interval '100 years'
    from unnest(p_attachment_ids) with ordinality ordered(id, ordinality)
    where a.id = ordered.id;
    update public.conversations set updated_at = now() where id = p_conversation_id;
    return v_message;
  end if;

  select * into v_existing from public.messages m
  where m.conversation_id = p_conversation_id and m.client_request_id = btrim(p_client_request_id);
  select coalesce(array_agg(a.id order by a.position), '{}'::uuid[])
    into v_existing_attachment_ids from public.message_attachments a where a.message_id = v_existing.id;
  if v_existing.id is not null and v_existing.sender_id = v_sender_id and v_existing.body = p_body
    and v_existing.reply_to_message_id is not distinct from p_reply_to_message_id
    and v_existing_attachment_ids = p_attachment_ids
  then return v_existing; end if;
  raise exception 'client_request_id conflicts with an existing message';
end;
$$;

grant execute on function public.send_chat_message(uuid, text, text, uuid, uuid[]) to authenticated;

create or replace function public.expire_unattached_chat_images()
returns setof public.message_attachments
language sql
security definer
volatile
set search_path = ''
as $$
  update public.message_attachments
  set status = 'cancelled', updated_at = now()
  where message_id is null and status in ('pending', 'uploaded', 'processing', 'ready', 'failed')
    and expires_at <= now()
  returning *;
$$;
revoke all on function public.expire_unattached_chat_images() from public, anon, authenticated;
grant execute on function public.expire_unattached_chat_images() to service_role;
