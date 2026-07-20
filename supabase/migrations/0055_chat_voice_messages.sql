-- Voice messages reuse the existing private chat-file attachment contract.
-- They are AAC recordings in an M4A/MP4 container and remain kind = 'file'.

update storage.buckets
set allowed_mime_types = array[
  'image/webp', 'image/jpeg', 'audio/mp4', 'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]
where id = 'chat-images';

create or replace function public.initialize_chat_attachment_upload(
  p_conversation_id uuid,
  p_client_upload_id text,
  p_original_name text,
  p_source_mime_type text,
  p_source_byte_size bigint,
  p_upload_sha256 text default null
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
  v_kind text;
  v_original_name text;
  v_window_count integer;
  v_retry_after integer;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;
  if p_client_upload_id is null or char_length(btrim(p_client_upload_id)) not between 1 and 120 then
    raise exception 'client upload id is required';
  end if;
  if p_upload_sha256 is not null and p_upload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'upload hash is invalid';
  end if;
  if p_source_mime_type not in (
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
    'audio/mp4',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) then raise exception 'file type is not supported'; end if;

  v_kind := case when p_source_mime_type like 'image/%' then 'image' else 'file' end;
  if (v_kind = 'image' and p_source_byte_size not between 1 and 26214400)
    or (v_kind = 'file' and p_source_byte_size not between 1 and 10485760)
  then raise exception 'file is too large'; end if;
  if p_original_name is null or char_length(p_original_name) > 1024 then
    raise exception 'file name is invalid';
  end if;
  v_original_name := private.sanitize_chat_attachment_name(p_original_name, v_kind);

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 174251));

  select * into v_attachment
  from public.message_attachments
  where uploader_id = v_user_id and client_upload_id = btrim(p_client_upload_id);
  if found then
    if v_attachment.conversation_id = p_conversation_id
      and v_attachment.original_name = v_original_name
      and v_attachment.source_mime_type = p_source_mime_type
      and v_attachment.source_byte_size = p_source_byte_size
      and v_attachment.upload_sha256 is not distinct from p_upload_sha256
    then return v_attachment; end if;
    raise exception 'client upload id conflicts with an existing attachment';
  end if;

  select count(*), greatest(
    1,
    ceil(extract(epoch from (min(created_at) + interval '10 minutes' - now())))::integer
  ) into v_window_count, v_retry_after
  from public.message_attachments
  where uploader_id = v_user_id and created_at > now() - interval '10 minutes';
  if v_window_count >= 20 then
    raise exception 'attachment upload short rate limit reached; retry after % seconds', v_retry_after;
  end if;

  select count(*), greatest(
    1,
    ceil(extract(epoch from (min(created_at) + interval '1 day' - now())))::integer
  ) into v_window_count, v_retry_after
  from public.message_attachments
  where uploader_id = v_user_id and created_at > now() - interval '1 day';
  if v_window_count >= 100 then
    raise exception 'attachment upload daily rate limit reached; retry after % seconds', v_retry_after;
  end if;

  insert into public.message_attachments (
    id, conversation_id, uploader_id, kind, client_upload_id, staging_path,
    original_name, source_mime_type, source_byte_size, upload_sha256, scan_status
  ) values (
    v_id, p_conversation_id, v_user_id, v_kind, btrim(p_client_upload_id),
    p_conversation_id::text || '/' || v_id::text || '/staging',
    v_original_name, p_source_mime_type, p_source_byte_size, p_upload_sha256,
    case when v_kind = 'image' then 'not_required' else 'pending' end
  ) returning * into v_attachment;
  return v_attachment;
end;
$$;

revoke all on function public.initialize_chat_attachment_upload(uuid, text, text, text, bigint, text)
  from public, anon;
grant execute on function public.initialize_chat_attachment_upload(uuid, text, text, text, bigint, text)
  to authenticated, service_role;
