-- Generalize private chat attachments while retaining the existing bucket and
-- RPC names for backwards compatibility with already-deployed image clients.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/webp', 'application/pdf', 'text/plain', 'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
where id = 'chat-images';

alter table public.message_attachments
  drop constraint message_attachments_kind_check,
  drop constraint message_attachments_ready_fields,
  drop constraint message_attachments_stored_byte_size_check;

alter table public.message_attachments
  add constraint message_attachments_kind_check check (kind in ('image', 'file')),
  add constraint message_attachments_stored_byte_size_check
    check (stored_byte_size is null or stored_byte_size between 1 and 10485760),
  add constraint message_attachments_ready_fields check (
    status <> 'ready' or (
      display_path is not null and stored_mime_type is not null and stored_byte_size is not null
      and (
        (kind = 'image' and thumbnail_path is not null and stored_mime_type = 'image/webp'
          and width is not null and height is not null)
        or
        (kind = 'file' and thumbnail_path is null and width is null and height is null)
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
language plpgsql security definer volatile set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_attachment public.message_attachments%rowtype;
  v_id uuid := gen_random_uuid();
  v_kind text;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if not private.is_conversation_member(p_conversation_id) then raise exception 'conversation not found'; end if;
  if p_client_upload_id is null or char_length(btrim(p_client_upload_id)) not between 1 and 120 then
    raise exception 'client upload id is required';
  end if;
  if p_original_name is null or char_length(btrim(p_original_name)) not between 1 and 255 then
    raise exception 'file name is invalid';
  end if;
  if p_source_mime_type not in (
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) then raise exception 'file type is not supported'; end if;
  if p_source_byte_size not between 1 and 10485760 then raise exception 'file is too large'; end if;
  if (select count(*) from public.message_attachments where uploader_id = v_user_id and created_at > now() - interval '10 minutes') >= 20
    or (select count(*) from public.message_attachments where uploader_id = v_user_id and created_at > now() - interval '1 day') >= 100
  then raise exception 'file upload rate limit reached'; end if;

  select * into v_attachment from public.message_attachments
  where uploader_id = v_user_id and client_upload_id = p_client_upload_id;
  if found then
    if v_attachment.conversation_id = p_conversation_id and v_attachment.original_name = btrim(p_original_name)
      and v_attachment.source_mime_type = p_source_mime_type and v_attachment.source_byte_size = p_source_byte_size
    then return v_attachment; end if;
    raise exception 'client upload id conflicts with an existing file';
  end if;

  v_kind := case when p_source_mime_type like 'image/%' then 'image' else 'file' end;
  insert into public.message_attachments (
    id, conversation_id, uploader_id, kind, client_upload_id, staging_path,
    original_name, source_mime_type, source_byte_size
  ) values (
    v_id, p_conversation_id, v_user_id, v_kind, btrim(p_client_upload_id),
    p_conversation_id::text || '/' || v_id::text || '/staging',
    btrim(p_original_name), p_source_mime_type, p_source_byte_size
  ) returning * into v_attachment;
  return v_attachment;
end;
$$;
