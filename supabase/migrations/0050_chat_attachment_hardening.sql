-- Harden the shared chat-attachment contract for durable mobile uploads.
-- Existing web clients keep using initialize_chat_image_upload and the
-- chat-image-command Edge function; new clients use attachment-neutral fields.

alter table public.message_attachments
  add column upload_sha256 text,
  add column verified_sha256 text,
  add column integrity_status text,
  add column scan_status text,
  add column scan_provider text,
  add column scan_reference text,
  add column scanned_at timestamptz,
  add column cleanup_claimed_at timestamptz,
  add column cleanup_token uuid,
  add column staging_cleaned_at timestamptz,
  add column upload_credentials_expires_at timestamptz;

-- Credentials minted before this migration did not have their expiry stored.
-- Keep those rows conservatively for the documented two-hour credential
-- lifetime after the last known upload transition.
update public.message_attachments
set upload_credentials_expires_at = greatest(
  expires_at,
  updated_at + interval '2 hours'
);

update public.message_attachments
set integrity_status = case
      when status = 'ready' then 'legacy_unverified'
      else 'pending'
    end,
    scan_status = case
  when kind = 'image' then 'not_required'
  when status = 'ready' then 'legacy_accepted'
  else 'pending'
end;

alter table public.message_attachments
  alter column scan_status set not null,
  alter column scan_status set default 'pending',
  alter column integrity_status set not null,
  alter column integrity_status set default 'pending';

alter table public.message_attachments
  drop constraint message_attachments_status_check,
  drop constraint message_attachments_source_byte_size_check,
  drop constraint message_attachments_ready_fields;

alter table public.message_attachments
  add constraint message_attachments_status_check check (
    status in ('pending', 'uploaded', 'processing', 'pending_scan', 'ready', 'failed', 'cancelled')
  ),
  add constraint message_attachments_source_byte_size_check check (
    source_byte_size >= 1 and (
      (kind = 'image' and source_byte_size <= 26214400)
      or (kind = 'file' and source_byte_size <= 10485760)
    )
  ),
  add constraint message_attachments_upload_sha256_check check (
    upload_sha256 is null or upload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  add constraint message_attachments_verified_sha256_check check (
    verified_sha256 is null or verified_sha256 ~ '^[0-9a-f]{64}$'
  ),
  add constraint message_attachments_integrity_status_check check (
    integrity_status in ('pending', 'verified', 'mismatch', 'legacy_unverified')
  ),
  add constraint message_attachments_scan_status_check check (
    scan_status in ('not_required', 'pending', 'clean', 'malicious', 'unavailable', 'legacy_accepted')
  );

alter table public.message_attachments
  add constraint message_attachments_ready_fields check (
    status <> 'ready' or (
      display_path is not null and stored_mime_type is not null and stored_byte_size is not null
      and (
        (integrity_status = 'verified' and verified_sha256 is not null)
        or (integrity_status = 'legacy_unverified' and verified_sha256 is null)
      )
      and (
        (kind = 'image' and thumbnail_path is not null and stored_mime_type = 'image/webp'
          and width is not null and height is not null and scan_status = 'not_required')
        or
        (kind = 'file' and thumbnail_path is null and width is null and height is null
          and scan_status in ('clean', 'legacy_accepted'))
      )
    )
  );

create index message_attachments_cleanup_candidates_idx
  on public.message_attachments (
    cleanup_claimed_at,
    upload_credentials_expires_at,
    expires_at,
    updated_at
  )
  where message_id is null;

create index message_attachments_staging_cleanup_candidates_idx
  on public.message_attachments (
    upload_credentials_expires_at,
    cleanup_claimed_at,
    updated_at
  )
  where status = 'ready' and staging_cleaned_at is null;

create table public.chat_attachment_cleanup_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  claimed_count integer not null check (claimed_count >= 0),
  deleted_count integer not null check (deleted_count >= 0),
  failed_count integer not null check (failed_count >= 0),
  deleted_bytes bigint not null check (deleted_bytes >= 0),
  oldest_created_at timestamptz
);

alter table public.chat_attachment_cleanup_runs enable row level security;
grant select, insert, update, delete on public.chat_attachment_cleanup_runs to service_role;
grant usage, select on sequence public.chat_attachment_cleanup_runs_id_seq to service_role;

create or replace function private.sanitize_chat_attachment_name(
  p_name text,
  p_kind text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text;
begin
  if p_kind = 'image' then return 'Photo'; end if;
  v_name := regexp_replace(coalesce(p_name, ''), '^.*[\\/]', '');
  v_name := regexp_replace(v_name, '[[:cntrl:]]', '', 'g');
  v_name := translate(v_name, U&'\202A\202B\202C\202D\202E\2066\2067\2068\2069', '');
  v_name := btrim(regexp_replace(v_name, '[[:space:]]+', ' ', 'g'));
  if v_name in ('', '.', '..') then return 'File'; end if;
  return left(v_name, 180);
end;
$$;

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

  -- Count-and-insert must be one uploader-scoped critical section. Without
  -- this transaction lock, parallel initializations can all observe the same
  -- pre-limit count and exceed both windows.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 174251));

  -- Recheck idempotency after taking the lock: another request with the same
  -- client upload id may have completed while this request was waiting.
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

-- Backwards-compatible RPC used by the existing web client.
create or replace function public.initialize_chat_image_upload(
  p_conversation_id uuid,
  p_client_upload_id text,
  p_original_name text,
  p_source_mime_type text,
  p_source_byte_size bigint
)
returns public.message_attachments
language sql
security definer
volatile
set search_path = ''
as $$
  select public.initialize_chat_attachment_upload(
    p_conversation_id, p_client_upload_id, p_original_name,
    p_source_mime_type, p_source_byte_size, null
  );
$$;

revoke all on function public.initialize_chat_image_upload(uuid, text, text, text, bigint)
  from public, anon;
grant execute on function public.initialize_chat_image_upload(uuid, text, text, text, bigint)
  to authenticated, service_role;

-- Record the longest-lived upload credential before exposing it to a caller.
-- Taking greatest() in the database prevents concurrent reissues from moving
-- cleanup eligibility backwards. Extending expires_at keeps a reissued token
-- useful for completion for its whole lifetime.
create or replace function public.record_chat_attachment_upload_credential(
  p_attachment_id uuid,
  p_expires_at timestamptz
)
returns timestamptz
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_recorded_expires_at timestamptz;
begin
  if p_attachment_id is null or p_expires_at is null or p_expires_at <= now() then
    raise exception 'upload credential expiry is invalid';
  end if;
  if p_expires_at > now() + interval '1 day' then
    raise exception 'upload credential expiry is too far in the future';
  end if;

  update public.message_attachments attachment
  set upload_credentials_expires_at = greatest(
        coalesce(attachment.upload_credentials_expires_at, '-infinity'::timestamptz),
        p_expires_at
      ),
      expires_at = greatest(attachment.expires_at, p_expires_at)
  where attachment.id = p_attachment_id
    and attachment.message_id is null
    and attachment.status in ('pending', 'uploaded', 'failed')
  returning attachment.upload_credentials_expires_at into v_recorded_expires_at;

  if v_recorded_expires_at is null then
    raise exception 'attachment is unavailable for upload';
  end if;
  return v_recorded_expires_at;
end;
$$;

revoke all on function public.record_chat_attachment_upload_credential(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_chat_attachment_upload_credential(uuid, timestamptz)
  to service_role;

-- The original storage policy matched staging_path for every bound ready
-- attachment. Conversation members may read only final display variants;
-- staging remains uploader-only while the row is unbound.
drop policy if exists "members read private chat image objects" on storage.objects;
create policy "members read private chat image objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1
      from public.message_attachments attachment
      where (
        attachment.uploader_id = (select auth.uid())
        and attachment.message_id is null
        and name in (
          attachment.staging_path,
          attachment.display_path,
          attachment.thumbnail_path
        )
      ) or (
        attachment.status = 'ready'
        and attachment.message_id is not null
        and name in (attachment.display_path, attachment.thumbnail_path)
        and private.is_conversation_member(attachment.conversation_id)
        and exists (
          select 1 from public.messages message
          where message.id = attachment.message_id and message.deleted_at is null
        )
      )
    )
  );

create or replace function public.claim_chat_attachment_cleanup(
  p_claim_token uuid,
  p_limit integer default 100
)
returns setof public.message_attachments
language plpgsql
security definer
volatile
set search_path = ''
as $$
begin
  if p_claim_token is null then raise exception 'claim token is required'; end if;
  return query
  with candidates as (
    select attachment.id
    from public.message_attachments attachment
    where attachment.message_id is null
      -- A removed row can no longer keep its immutable staging path occupied.
      -- Never remove that replay guard while any issued credential can create
      -- the object again.
      and (
        attachment.upload_credentials_expires_at is null
        or attachment.upload_credentials_expires_at <= now()
      )
      and (
        attachment.expires_at <= now()
        or (
          attachment.status in ('failed', 'cancelled')
          and attachment.updated_at <= now() - interval '15 minutes'
        )
      )
      and (
        attachment.cleanup_claimed_at is null
        or attachment.cleanup_claimed_at <= now() - interval '30 minutes'
      )
    order by attachment.expires_at, attachment.created_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  )
  update public.message_attachments attachment
  set status = 'cancelled', cleanup_claimed_at = now(), cleanup_token = p_claim_token,
      updated_at = now()
  from candidates
  where attachment.id = candidates.id
  returning attachment.*;
end;
$$;

revoke all on function public.claim_chat_attachment_cleanup(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_chat_attachment_cleanup(uuid, integer) to service_role;

create or replace function public.finish_chat_attachment_cleanup(
  p_claim_token uuid,
  p_deleted_ids uuid[]
)
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with removed as (
    delete from public.message_attachments
    where cleanup_token = p_claim_token
      and message_id is null
      and id = any(coalesce(p_deleted_ids, '{}'::uuid[]))
    returning id
  ) select count(*) into v_deleted from removed;

  update public.message_attachments
  set cleanup_token = null, cleanup_claimed_at = null
  where cleanup_token = p_claim_token and message_id is null;
  return v_deleted;
end;
$$;

revoke all on function public.finish_chat_attachment_cleanup(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.finish_chat_attachment_cleanup(uuid, uuid[]) to service_role;

-- Signed upload tokens can be replayed until they expire. Keep the immutable
-- staging object in place while a ready row is inside that token lifetime so
-- a replayed create (upsert=false) remains occupied, then remove only staging.
-- Final variants and bound messages are deliberately outside this cleanup.
create or replace function public.claim_chat_attachment_staging_cleanup(
  p_claim_token uuid,
  p_limit integer default 100
)
returns setof public.message_attachments
language plpgsql
security definer
volatile
set search_path = ''
as $$
begin
  if p_claim_token is null then raise exception 'claim token is required'; end if;
  return query
  with candidates as (
    select attachment.id
    from public.message_attachments attachment
    where attachment.status = 'ready'
      and attachment.staging_cleaned_at is null
      -- Every Edge-issued credential records its exact JWT expiry (with the
      -- documented two-hour lifetime as a conservative floor). Null is only
      -- possible for rows created without an upload credential.
      and coalesce(
        attachment.upload_credentials_expires_at,
        attachment.updated_at
      ) <= now()
      and (
        attachment.cleanup_claimed_at is null
        or attachment.cleanup_claimed_at <= now() - interval '30 minutes'
      )
    order by attachment.updated_at, attachment.created_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  )
  update public.message_attachments attachment
  set cleanup_claimed_at = now(), cleanup_token = p_claim_token
  from candidates
  where attachment.id = candidates.id
  returning attachment.*;
end;
$$;

revoke all on function public.claim_chat_attachment_staging_cleanup(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_chat_attachment_staging_cleanup(uuid, integer)
  to service_role;

create or replace function public.finish_chat_attachment_staging_cleanup(
  p_claim_token uuid,
  p_deleted_ids uuid[]
)
returns integer
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_finished integer;
begin
  with finished as (
    update public.message_attachments
    set staging_cleaned_at = now(), cleanup_token = null, cleanup_claimed_at = null
    where cleanup_token = p_claim_token
      and status = 'ready'
      and id = any(coalesce(p_deleted_ids, '{}'::uuid[]))
    returning id
  ) select count(*) into v_finished from finished;

  -- Storage failures remain retryable on the next scheduled pass.
  update public.message_attachments
  set cleanup_token = null, cleanup_claimed_at = null
  where cleanup_token = p_claim_token;
  return v_finished;
end;
$$;

revoke all on function public.finish_chat_attachment_staging_cleanup(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.finish_chat_attachment_staging_cleanup(uuid, uuid[])
  to service_role;

create or replace function public.expire_unattached_chat_images()
returns setof public.message_attachments
language sql
security definer
volatile
set search_path = ''
as $$
  update public.message_attachments
  set status = 'cancelled', updated_at = now()
  where message_id is null
    and status in ('pending', 'uploaded', 'processing', 'pending_scan', 'ready', 'failed')
    and expires_at <= now()
  returning *;
$$;

revoke all on function public.expire_unattached_chat_images()
  from public, anon, authenticated;
grant execute on function public.expire_unattached_chat_images() to service_role;

-- Configure the fifteen-minute cleanup call with dedicated least-privilege
-- credentials. The secret is kept in Vault and is not a service-role key.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.configure_chat_attachment_cleanup(
  p_project_url text,
  p_cleanup_secret text
)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_url_secret_id uuid;
  v_cleanup_secret_id uuid;
begin
  if p_project_url !~ '^https://[a-z0-9.-]+$'
    or char_length(p_cleanup_secret) < 32
  then raise exception 'cleanup configuration is invalid'; end if;

  select id into v_url_secret_id from vault.secrets where name = 'chat_attachment_project_url';
  if v_url_secret_id is null then
    perform vault.create_secret(p_project_url, 'chat_attachment_project_url', 'Chat attachment cleanup Edge base URL');
  else
    perform vault.update_secret(v_url_secret_id, p_project_url);
  end if;
  select id into v_cleanup_secret_id from vault.secrets where name = 'chat_attachment_cleanup_secret';
  if v_cleanup_secret_id is null then
    perform vault.create_secret(p_cleanup_secret, 'chat_attachment_cleanup_secret', 'Dedicated chat attachment cleanup credential');
  else
    perform vault.update_secret(v_cleanup_secret_id, p_cleanup_secret);
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-chat-attachments';
  perform cron.schedule(
    'cleanup-chat-attachments',
    '*/15 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets
          where name = 'chat_attachment_project_url') || '/functions/v1/chat-image-command',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cleanup-secret', (select decrypted_secret from vault.decrypted_secrets
            where name = 'chat_attachment_cleanup_secret')
        ),
        body := '{"action":"cleanup-expired"}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$
  );
end;
$$;

revoke all on function public.configure_chat_attachment_cleanup(text, text)
  from public, anon, authenticated;
grant execute on function public.configure_chat_attachment_cleanup(text, text) to service_role;
