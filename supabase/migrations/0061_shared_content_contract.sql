-- Phase 11: one authorized, deterministic shared-content contract.
-- This migration deliberately keeps the gallery as a retrieval projection over
-- existing chat sources. It does not add a sending or upload pipeline.

alter table public.message_attachments
  add column delete_requested_at timestamptz;

-- Link jobs are created only after firstPublicHttpUrl has accepted the URL.
-- Persist that already-validated identity even when enrichment never succeeds.
insert into public.message_link_previews (
  message_id,
  url,
  hostname
)
select
  job.message_id,
  job.url,
  lower(
    split_part(
      split_part(
        split_part(regexp_replace(job.url, '^https?://', ''), '/', 1),
        '?',
        1
      ),
      '#',
      1
    )
  )
from public.chat_link_preview_jobs job
on conflict (message_id) do nothing;

drop policy if exists "members read message link previews" on public.message_link_previews;
create policy "members read message link previews"
  on public.message_link_previews
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages message
      where message.id = message_link_previews.message_id
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
    )
  );

drop policy if exists "members read ready message attachments" on public.message_attachments;
create policy "members read ready message attachments"
  on public.message_attachments
  for select to authenticated
  using (
    (uploader_id = (select auth.uid()) and message_id is null)
    or (
      delete_requested_at is null
      and status = 'ready'
      and message_id is not null
      and private.is_conversation_member(conversation_id)
      and exists (
        select 1
        from public.messages message
        where message.id = message_attachments.message_id
          and message.deleted_at is null
      )
    )
  );

drop policy if exists "members read private chat image objects" on storage.objects;
create policy "members read private chat image objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1
      from public.message_attachments attachment
      where (
        (
          attachment.uploader_id = (select auth.uid())
          and attachment.message_id is null
          and name = attachment.staging_path
        )
        or (
          attachment.delete_requested_at is null
          and attachment.status = 'ready'
          and attachment.message_id is not null
          and name in (attachment.display_path, attachment.thumbnail_path)
          and private.is_conversation_member(attachment.conversation_id)
          and exists (
            select 1
            from public.messages message
            where message.id = attachment.message_id
              and message.deleted_at is null
          )
        )
      )
    )
  );

create or replace function public.list_conversation_shared_content(
  p_conversation_id uuid,
  p_category text default null,
  p_before_created_at timestamptz default null,
  p_before_message_id uuid default null,
  p_before_source_rank integer default null,
  p_before_item_id text default null,
  p_limit integer default 40
)
returns table (
  item_id text,
  conversation_id uuid,
  source_message_id uuid,
  sender_id uuid,
  source_created_at timestamptz,
  source_rank integer,
  category text,
  kind text,
  attachment_id uuid,
  attachment_original_name text,
  attachment_mime_type text,
  attachment_byte_size bigint,
  attachment_width integer,
  attachment_height integer,
  attachment_display_path text,
  attachment_thumbnail_path text,
  gif_provider text,
  gif_provider_content_id text,
  gif_title text,
  gif_description text,
  sticker_id text,
  link_url text,
  link_hostname text,
  link_title text,
  link_description text,
  link_site_name text,
  can_delete boolean,
  can_export boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_conversation_id is null
    or not private.is_conversation_member(p_conversation_id)
  then
    return;
  end if;

  if p_category is not null and p_category not in ('media', 'files', 'links', 'voice') then
    raise exception 'category is not supported';
  end if;

  if p_limit is null or p_limit not between 1 and 40 then
    raise exception 'limit must be between 1 and 40';
  end if;

  if (
    p_before_created_at is null
    and p_before_message_id is null
    and p_before_source_rank is null
    and p_before_item_id is null
  ) then
    null;
  elsif (
    p_before_created_at is null
    or p_before_message_id is null
    or p_before_source_rank is null
    or p_before_item_id is null
  ) then
    raise exception 'cursor must contain all four fields';
  end if;

  return query
  with eligible (
    item_id,
    conversation_id,
    source_message_id,
    sender_id,
    source_created_at,
    source_rank,
    category,
    kind,
    attachment_id,
    attachment_original_name,
    attachment_mime_type,
    attachment_byte_size,
    attachment_width,
    attachment_height,
    attachment_display_path,
    attachment_thumbnail_path,
    gif_provider,
    gif_provider_content_id,
    gif_title,
    gif_description,
    sticker_id,
    link_url,
    link_hostname,
    link_title,
    link_description,
    link_site_name,
    can_delete,
    can_export
  ) as (
    select
      'attachment:' || attachment.id::text,
      message.conversation_id,
      message.id,
      message.sender_id,
      message.created_at,
      100 - attachment.position,
      case
        when attachment.kind = 'image' then 'media'
        when attachment.stored_mime_type = 'video/mp4' then 'media'
        when attachment.stored_mime_type = 'audio/mp4' then 'voice'
        else 'files'
      end,
      case
        when attachment.kind = 'image' then 'photo'
        when attachment.stored_mime_type = 'video/mp4' then 'video'
        when attachment.stored_mime_type = 'audio/mp4' then 'voice'
        else 'document'
      end,
      attachment.id,
      attachment.original_name,
      attachment.stored_mime_type,
      attachment.stored_byte_size,
      attachment.width,
      attachment.height,
      attachment.display_path,
      attachment.thumbnail_path,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      message.sender_id = (select auth.uid()),
      true
    from public.message_attachments attachment
    join public.messages message on message.id = attachment.message_id
    where attachment.conversation_id = p_conversation_id
      and message.conversation_id = p_conversation_id
      and attachment.conversation_id = message.conversation_id
      and attachment.delete_requested_at is null
      and attachment.status = 'ready'
      and attachment.message_id is not null
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
      and (
        (attachment.kind = 'image' and attachment.stored_mime_type = 'image/webp')
        or (
          attachment.kind = 'file'
          and attachment.stored_mime_type in (
            'video/mp4',
            'audio/mp4',
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          )
        )
      )
    union all
    select
      'gif:' || gif.message_id::text,
      message.conversation_id,
      message.id,
      message.sender_id,
      message.created_at,
      90,
      'media',
      'gif',
      null::uuid,
      null::text,
      null::text,
      null::bigint,
      null::integer,
      null::integer,
      null::text,
      null::text,
      gif.provider,
      gif.provider_content_id,
      gif.title,
      gif.description,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      message.sender_id = (select auth.uid()),
      false
    from public.message_gifs gif
    join public.messages message on message.id = gif.message_id
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
    union all
    select
      'sticker:' || message.id::text,
      message.conversation_id,
      message.id,
      message.sender_id,
      message.created_at,
      89,
      'media',
      'sticker',
      null::uuid,
      null::text,
      null::text,
      null::bigint,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      message.sticker_id,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      message.sender_id = (select auth.uid()),
      false
    from public.messages message
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and message.sticker_id is not null
      and private.is_conversation_member(message.conversation_id)
    union all
    select
      'link:' || preview.message_id::text,
      message.conversation_id,
      message.id,
      message.sender_id,
      message.created_at,
      80,
      'links',
      'link',
      null::uuid,
      null::text,
      null::text,
      null::bigint,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      preview.url,
      preview.hostname,
      preview.title,
      preview.description,
      preview.site_name,
      message.sender_id = (select auth.uid()),
      true
    from public.message_link_previews preview
    join public.messages message on message.id = preview.message_id
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
  ), filtered as (
    select *
    from eligible
    where (p_category is null or eligible.category = p_category)
      and (
        p_before_created_at is null
        or (
          eligible.source_created_at,
          eligible.source_message_id,
          eligible.source_rank,
          eligible.item_id collate "C"
        ) < (
          p_before_created_at,
          p_before_message_id,
          p_before_source_rank,
          p_before_item_id collate "C"
        )
      )
  )
  select *
  from filtered
  order by
    filtered.source_created_at desc,
    filtered.source_message_id desc,
    filtered.source_rank desc,
    filtered.item_id collate "C" desc
  limit (p_limit + 1);
end;
$$;

create or replace function public.list_conversation_shared_content_categories(
  p_conversation_id uuid
)
returns table (category text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_conversation_id is null
    or not private.is_conversation_member(p_conversation_id)
  then
    return;
  end if;

  return query
  with eligible_categories as (
    select 'media'::text as category
    from public.message_attachments attachment
    join public.messages message on message.id = attachment.message_id
    where attachment.conversation_id = p_conversation_id
      and message.conversation_id = p_conversation_id
      and attachment.conversation_id = message.conversation_id
      and attachment.delete_requested_at is null
      and attachment.status = 'ready'
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
      and (
        (attachment.kind = 'image' and attachment.stored_mime_type = 'image/webp')
        or (
          attachment.kind = 'file'
          and attachment.stored_mime_type in ('video/mp4')
        )
      )
    union all
    select 'media'::text
    from public.message_gifs gif
    join public.messages message on message.id = gif.message_id
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
    union all
    select 'media'::text
    from public.messages message
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and message.sticker_id is not null
      and private.is_conversation_member(message.conversation_id)
    union all
    select 'files'::text
    from public.message_attachments attachment
    join public.messages message on message.id = attachment.message_id
    where attachment.conversation_id = p_conversation_id
      and message.conversation_id = p_conversation_id
      and attachment.conversation_id = message.conversation_id
      and attachment.delete_requested_at is null
      and attachment.status = 'ready'
      and attachment.kind = 'file'
      and attachment.stored_mime_type in (
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
    union all
    select 'links'::text
    from public.message_link_previews preview
    join public.messages message on message.id = preview.message_id
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
    union all
    select 'voice'::text
    from public.message_attachments attachment
    join public.messages message on message.id = attachment.message_id
    where attachment.conversation_id = p_conversation_id
      and message.conversation_id = p_conversation_id
      and attachment.conversation_id = message.conversation_id
      and attachment.delete_requested_at is null
      and attachment.status = 'ready'
      and attachment.kind = 'file'
      and attachment.stored_mime_type = 'audio/mp4'
      and message.deleted_at is null
      and private.is_conversation_member(message.conversation_id)
  )
  select distinct_categories.category
  from (
    select distinct eligible_categories.category
    from eligible_categories
  ) distinct_categories
  order by case distinct_categories.category
    when 'media' then 1
    when 'files' then 2
    when 'links' then 3
    when 'voice' then 4
  end;
end;
$$;

create or replace function public.list_conversation_message_context(
  p_conversation_id uuid,
  p_message_id uuid,
  p_before integer default 20,
  p_after integer default 20
)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_id uuid,
  sender_role text,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  reply_to_message_id uuid,
  sticker_id text,
  has_older_gap boolean,
  has_newer_gap boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_target public.messages%rowtype;
  v_has_older_gap boolean;
  v_has_newer_gap boolean;
begin
  if p_conversation_id is null
    or p_message_id is null
    or not private.is_conversation_member(p_conversation_id)
  then
    return;
  end if;

  if p_before is null or p_before not between 0 and 20
    or p_after is null or p_after not between 0 and 20
  then
    raise exception 'context bounds must be between 0 and 20';
  end if;

  select message.*
  into v_target
  from public.messages message
  where message.id = p_message_id
    and message.conversation_id = p_conversation_id
    and message.deleted_at is null;

  if not found then
    return;
  end if;

  select exists (
    select 1
    from public.messages message
    where message.conversation_id = p_conversation_id
      and (
        message.created_at,
        message.id
      ) < (
        v_target.created_at,
        v_target.id
      )
    order by message.created_at desc, message.id desc
    limit (p_before + 1)
    offset p_before
  ) into v_has_older_gap;

  select exists (
    select 1
    from public.messages message
    where message.conversation_id = p_conversation_id
      and (
        message.created_at,
        message.id
      ) > (
        v_target.created_at,
        v_target.id
      )
    order by message.created_at asc, message.id asc
    limit 1 offset p_after
  ) into v_has_newer_gap;

  return query
  with older as (
    select message.*
    from public.messages message
    where message.conversation_id = p_conversation_id
      and (message.created_at, message.id) < (v_target.created_at, v_target.id)
    order by message.created_at desc, message.id desc
    limit p_before
  ), newer as (
    select message.*
    from public.messages message
    where message.conversation_id = p_conversation_id
      and (message.created_at, message.id) > (v_target.created_at, v_target.id)
    order by message.created_at asc, message.id asc
    limit p_after
  ), context_rows as (
    select * from older
    union all
    select v_target.*
    union all
    select * from newer
  )
  select
    context_rows.id,
    context_rows.conversation_id,
    context_rows.sender_id,
    context_rows.sender_role,
    context_rows.body,
    context_rows.created_at,
    context_rows.edited_at,
    context_rows.deleted_at,
    context_rows.reply_to_message_id,
    context_rows.sticker_id,
    v_has_older_gap,
    v_has_newer_gap
  from context_rows
  order by context_rows.created_at asc, context_rows.id asc;
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

  update public.message_attachments attachment
  set delete_requested_at = coalesce(attachment.delete_requested_at, now()),
      updated_at = now()
  where attachment.message_id = p_message_id;

  update public.conversations
  set updated_at = now()
  where id = v_message.conversation_id;

  return v_message;
end;
$$;

create or replace function public.claim_deleted_chat_attachment_cleanup(
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
  if p_claim_token is null then
    raise exception 'claim token is required';
  end if;

  return query
  with candidates as (
    select attachment.id
    from public.message_attachments attachment
    where attachment.message_id is not null
      and attachment.delete_requested_at is not null
      and (
        attachment.cleanup_claimed_at is null
        or attachment.cleanup_claimed_at <= now() - interval '30 minutes'
      )
    order by attachment.delete_requested_at, attachment.created_at, attachment.id
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  )
  update public.message_attachments attachment
  set cleanup_claimed_at = now(),
      cleanup_token = p_claim_token,
      updated_at = now()
  from candidates
  where attachment.id = candidates.id
  returning attachment.*;
end;
$$;

create or replace function public.finish_deleted_chat_attachment_cleanup(
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
  if p_claim_token is null then
    raise exception 'claim token is required';
  end if;

  with removed as (
    delete from public.message_attachments
    where cleanup_token = p_claim_token
      and message_id is not null
      and id = any(coalesce(p_deleted_ids, '{}'::uuid[]))
    returning id
  )
  select count(*) into v_deleted from removed;

  -- Storage failures remain retryable on the next scheduled pass. Rows not
  -- acknowledged by the worker lose their claim and can be reclaimed.
  update public.message_attachments
  set cleanup_token = null,
      cleanup_claimed_at = null
  where cleanup_token = p_claim_token;

  return v_deleted;
end;
$$;

revoke execute on function public.list_conversation_shared_content(
  uuid, text, timestamptz, uuid, integer, text, integer
) from public, anon;
grant execute on function public.list_conversation_shared_content(
  uuid, text, timestamptz, uuid, integer, text, integer
) to authenticated;

revoke execute on function public.list_conversation_shared_content_categories(uuid)
  from public, anon;
grant execute on function public.list_conversation_shared_content_categories(uuid)
  to authenticated;

revoke execute on function public.list_conversation_message_context(uuid, uuid, integer, integer)
  from public, anon;
grant execute on function public.list_conversation_message_context(uuid, uuid, integer, integer)
  to authenticated;

revoke execute on function public.delete_chat_message(uuid) from public, anon;
grant execute on function public.delete_chat_message(uuid) to authenticated;

revoke execute on function public.claim_deleted_chat_attachment_cleanup(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_deleted_chat_attachment_cleanup(uuid, integer)
  to service_role;

revoke execute on function public.finish_deleted_chat_attachment_cleanup(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.finish_deleted_chat_attachment_cleanup(uuid, uuid[])
  to service_role;
