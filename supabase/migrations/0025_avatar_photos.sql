-- Private, processed avatar photos for clients and coaches.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles
  add column avatar_path text,
  add column avatar_thumbnail_path text,
  add column avatar_updated_at timestamptz,
  add constraint profiles_avatar_shape check (
    (avatar_path is null and avatar_thumbnail_path is null and avatar_updated_at is null)
    or
    (avatar_path is not null and avatar_thumbnail_path is not null and avatar_updated_at is not null)
  );

create table public.avatar_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_upload_id text not null,
  original_name text not null,
  source_mime_type text not null,
  source_byte_size bigint not null check (source_byte_size between 1 and 10485760),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed', 'cancelled', 'superseded')),
  staging_path text not null unique,
  avatar_path text unique,
  thumbnail_path text unique,
  stored_byte_size bigint check (stored_byte_size is null or stored_byte_size between 1 and 2097152),
  stored_width integer check (stored_width is null or stored_width between 1 and 512),
  stored_height integer check (stored_height is null or stored_height between 1 and 512),
  failure_code text,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avatar_uploads_user_request_unique unique (user_id, client_upload_id),
  constraint avatar_uploads_ready_shape check (
    status <> 'ready'
    or (
      avatar_path is not null and thumbnail_path is not null
      and stored_byte_size is not null and stored_width is not null and stored_height is not null
    )
  )
);

create index avatar_uploads_user_created_idx
  on public.avatar_uploads (user_id, created_at desc);
create index avatar_uploads_cleanup_idx
  on public.avatar_uploads (status, expires_at);

alter table public.avatar_uploads enable row level security;
grant select, insert, update, delete on public.avatar_uploads to service_role;

create or replace function public.prevent_avatar_pointer_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_path is distinct from old.avatar_path
    or new.avatar_thumbnail_path is distinct from old.avatar_thumbnail_path
    or new.avatar_updated_at is distinct from old.avatar_updated_at
  then
    raise exception 'avatar pointers cannot be changed by this caller';
  end if;
  return new;
end;
$$;

create trigger prevent_avatar_pointer_change
  before update on public.profiles
  for each row
  when (auth.role() = 'authenticated')
  execute function public.prevent_avatar_pointer_self_update();

create or replace function private.can_view_profile_avatar(target_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (select 1 from public.profiles p where p.id = target_uuid)
    and not (
      target_uuid <> (select auth.uid())
      and private.is_blocked_pair((select auth.uid()), target_uuid)
    );
$$;

create policy "members read visible avatar objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (
        name not like '%/staging.webp'
        and private.can_view_profile_avatar(((storage.foldername(name))[1])::uuid)
      )
    )
  );

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
  if (select count(*) from public.avatar_uploads where user_id = v_user_id and created_at > now() - interval '10 minutes') >= 5
    or (select count(*) from public.avatar_uploads where user_id = v_user_id and created_at > now() - interval '1 day') >= 20
  then
    raise exception 'avatar upload rate limit reached';
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

create or replace function public.publish_avatar_upload(
  p_user_id uuid,
  p_upload_id uuid,
  p_avatar_path text,
  p_thumbnail_path text,
  p_stored_byte_size bigint,
  p_stored_width integer,
  p_stored_height integer
)
returns table (
  published boolean,
  old_avatar_path text,
  old_thumbnail_path text,
  published_at timestamptz
)
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_upload public.avatar_uploads%rowtype;
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
begin
  select * into v_upload from public.avatar_uploads where id = p_upload_id for update;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if v_upload.id is null or v_profile.id is null
    or v_upload.user_id <> p_user_id or v_upload.status <> 'processing'
  then
    return query select false, null::text, null::text, null::timestamptz;
    return;
  end if;
  if exists (
    select 1 from public.avatar_uploads newer
    where newer.user_id = p_user_id
      and newer.created_at > v_upload.created_at
      and newer.status in ('pending', 'processing', 'ready')
  ) then
    update public.avatar_uploads set status = 'superseded', updated_at = v_now where id = p_upload_id;
    return query select false, null::text, null::text, null::timestamptz;
    return;
  end if;

  update public.profiles
  set avatar_path = p_avatar_path,
      avatar_thumbnail_path = p_thumbnail_path,
      avatar_updated_at = v_now,
      updated_at = v_now
  where id = p_user_id;

  update public.avatar_uploads
  set status = 'ready', avatar_path = p_avatar_path, thumbnail_path = p_thumbnail_path,
      stored_byte_size = p_stored_byte_size, stored_width = p_stored_width,
      stored_height = p_stored_height, failure_code = null, updated_at = v_now
  where id = p_upload_id;

  return query select true, v_profile.avatar_path, v_profile.avatar_thumbnail_path, v_now;
end;
$$;

revoke execute on function public.publish_avatar_upload(uuid, uuid, text, text, bigint, integer, integer) from public, authenticated;
grant execute on function public.publish_avatar_upload(uuid, uuid, text, text, bigint, integer, integer) to service_role;

create or replace function public.remove_profile_avatar(p_user_id uuid)
returns table (old_avatar_path text, old_thumbnail_path text)
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return query select null::text, null::text;
    return;
  end if;
  update public.avatar_uploads
  set status = 'superseded', updated_at = now()
  where user_id = p_user_id and status in ('pending', 'processing');
  update public.profiles
  set avatar_path = null, avatar_thumbnail_path = null, avatar_updated_at = null, updated_at = now()
  where id = p_user_id;
  return query select v_profile.avatar_path, v_profile.avatar_thumbnail_path;
end;
$$;

revoke execute on function public.remove_profile_avatar(uuid) from public, authenticated;
grant execute on function public.remove_profile_avatar(uuid) to service_role;

create or replace function public.resolve_avatar_paths(
  p_profile_ids uuid[],
  p_variant text default 'thumbnail'
)
returns table (profile_id uuid, object_path text)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  if coalesce(array_length(p_profile_ids, 1), 0) > 100 then raise exception 'too many profiles'; end if;
  if p_variant not in ('thumbnail', 'display') then raise exception 'avatar variant is invalid'; end if;
  return query
  select p.id,
    case when p_variant = 'display' then p.avatar_path else p.avatar_thumbnail_path end
  from public.profiles p
  where p.id = any(coalesce(p_profile_ids, array[]::uuid[]))
    and private.can_view_profile_avatar(p.id)
    and p.avatar_path is not null;
end;
$$;

revoke execute on function public.resolve_avatar_paths(uuid[], text) from public;
grant execute on function public.resolve_avatar_paths(uuid[], text) to authenticated;
