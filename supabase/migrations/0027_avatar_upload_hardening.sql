-- Make avatar rollout cleanup retryable and upload initialization idempotent.

create or replace function public.initialize_avatar_upload(
  p_client_upload_id text,
  p_original_name text,
  p_source_mime_type text,
  p_source_byte_size bigint
)
returns public.avatar_uploads
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_upload public.avatar_uploads%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if p_client_upload_id is null or char_length(btrim(p_client_upload_id)) not between 1 and 120 then
    raise exception 'client upload id is required';
  end if;
  if p_original_name is null or char_length(btrim(p_original_name)) not between 1 and 255 then
    raise exception 'photo name is invalid';
  end if;
  if p_source_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'photo type is not supported';
  end if;
  if p_source_byte_size not between 1 and 10485760 then
    raise exception 'photo is too large';
  end if;

  select * into v_upload
  from public.avatar_uploads
  where user_id = v_user_id and client_upload_id = btrim(p_client_upload_id);
  if found then
    if v_upload.original_name = btrim(p_original_name)
      and v_upload.source_mime_type = p_source_mime_type
      and v_upload.source_byte_size = p_source_byte_size
    then
      return v_upload;
    end if;
    raise exception 'client upload id conflicts with an existing photo';
  end if;

  if (select count(*) from public.avatar_uploads where user_id = v_user_id and created_at > now() - interval '10 minutes') >= 5
    or (select count(*) from public.avatar_uploads where user_id = v_user_id and created_at > now() - interval '1 day') >= 20
  then
    raise exception 'avatar upload rate limit reached';
  end if;

  update public.avatar_uploads
  set status = 'superseded', updated_at = now()
  where user_id = v_user_id and status in ('pending', 'processing');

  insert into public.avatar_uploads (
    id, user_id, client_upload_id, original_name, source_mime_type,
    source_byte_size, staging_path
  ) values (
    v_id, v_user_id, btrim(p_client_upload_id), btrim(p_original_name), p_source_mime_type,
    p_source_byte_size, v_user_id::text || '/' || v_id::text || '/staging.webp'
  ) returning * into v_upload;

  return v_upload;
end;
$$;

revoke execute on function public.initialize_avatar_upload(text, text, text, bigint) from public;
grant execute on function public.initialize_avatar_upload(text, text, text, bigint) to authenticated;

create or replace function public.list_avatar_cleanup_candidates(p_limit integer default 100)
returns setof public.avatar_uploads
language sql
security definer
stable
set search_path = ''
as $$
  select upload.*
  from public.avatar_uploads upload
  where (
    upload.status <> 'ready'
    and upload.expires_at < now()
  ) or (
    upload.status = 'ready'
    and upload.updated_at < now() - interval '30 days'
    and not exists (
      select 1
      from public.profiles profile
      where profile.avatar_path = upload.avatar_path
        or profile.avatar_thumbnail_path = upload.thumbnail_path
    )
  )
  order by least(upload.expires_at, upload.updated_at), upload.id
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke execute on function public.list_avatar_cleanup_candidates(integer) from public, authenticated;
grant execute on function public.list_avatar_cleanup_candidates(integer) to service_role;
