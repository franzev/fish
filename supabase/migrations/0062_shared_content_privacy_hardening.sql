-- Phase 11 gap closure: harden the deployed shared-content boundary without
-- rewriting the already-applied 0061 contract.

alter table public.message_link_previews
  add column safe_link_validation_version smallint,
  add column safe_link_validated_at timestamptz;

create or replace function private.is_canonical_safe_link_identity(
  p_url text,
  p_hostname text,
  p_validation_version smallint,
  p_validated_at timestamptz
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_authority text;
  v_hostname text;
  v_octet_1 integer;
  v_octet_2 integer;
  v_octet_3 integer;
  v_octet_4 integer;
begin
  if p_validation_version is distinct from 2
    or p_validated_at is null
    or p_url is null
    or p_hostname is null
    or p_url !~ '^https?://'
    or p_url ~ '[[:space:]]'
    or position('#' in p_url) > 0
  then
    return false;
  end if;

  v_authority := split_part(split_part(p_url, '://', 2), '/', 1);
  v_authority := split_part(v_authority, '?', 1);
  v_hostname := lower(v_authority);

  if v_authority = ''
    or position('@' in v_authority) > 0
    or position(':' in v_authority) > 0
    or p_hostname <> v_hostname
    or p_hostname <> lower(p_hostname)
    or v_hostname !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$'
  then
    return false;
  end if;

  if v_hostname = 'localhost'
    or v_hostname ~ '(^|\.)localhost$'
    or v_hostname ~ '(^|\.)local$'
    or v_hostname ~ '(^|\.)internal$'
  then
    return false;
  end if;

  if v_hostname ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' then
    v_octet_1 := split_part(v_hostname, '.', 1)::integer;
    v_octet_2 := split_part(v_hostname, '.', 2)::integer;
    v_octet_3 := split_part(v_hostname, '.', 3)::integer;
    v_octet_4 := split_part(v_hostname, '.', 4)::integer;

    if greatest(v_octet_1, v_octet_2, v_octet_3, v_octet_4) > 255
      or v_octet_1 = 0
      or v_octet_1 = 10
      or v_octet_1 = 127
      or (v_octet_1 = 100 and v_octet_2 between 64 and 127)
      or (v_octet_1 = 169 and v_octet_2 = 254)
      or (v_octet_1 = 172 and v_octet_2 between 16 and 31)
      or (v_octet_1 = 192 and v_octet_2 = 168)
      or v_octet_1 between 224 and 239
      or (v_octet_1 = 255 and v_octet_2 = 255 and v_octet_3 = 255 and v_octet_4 = 255)
    then
      return false;
    end if;
  end if;

  return true;
end;
$$;

alter table public.message_link_previews
  add constraint message_link_previews_safe_link_proof_check check (
    (
      safe_link_validation_version is null
      and safe_link_validated_at is null
    )
    or private.is_canonical_safe_link_identity(
      url,
      hostname,
      safe_link_validation_version,
      safe_link_validated_at
    )
  );

create index if not exists messages_shared_content_live_conversation_order_idx
  on public.messages (conversation_id, created_at desc, id desc)
  where deleted_at is null;

create index if not exists message_attachments_shared_content_ready_idx
  on public.message_attachments (message_id, position desc, id desc)
  where status = 'ready' and message_id is not null and delete_requested_at is null;

update public.message_attachments attachment
set delete_requested_at = coalesce(attachment.delete_requested_at, message.deleted_at, now()),
    updated_at = now()
from public.messages message
where attachment.message_id = message.id
  and message.deleted_at is not null
  and attachment.delete_requested_at is null;

create or replace function private.enforce_deleted_source_attachment_cleanup()
returns trigger
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
begin
  if new.message_id is null or new.delete_requested_at is not null then
    return new;
  end if;

  select message.deleted_at
  into v_deleted_at
  from public.messages message
  where message.id = new.message_id;

  if v_deleted_at is not null then
    new.delete_requested_at := v_deleted_at;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists message_attachments_deleted_source_cleanup
  on public.message_attachments;
create trigger message_attachments_deleted_source_cleanup
before insert or update of message_id on public.message_attachments
for each row
execute function private.enforce_deleted_source_attachment_cleanup();

drop policy if exists "members read message link previews" on public.message_link_previews;
create policy "members read message link previews"
  on public.message_link_previews
  for select to authenticated
  using (
    private.is_canonical_safe_link_identity(
      url,
      hostname,
      safe_link_validation_version,
      safe_link_validated_at
    )
    and exists (
      select 1
      from public.messages message
      where message.id = message_link_previews.message_id
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
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
    select *
    from (
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
              'video/mp4', 'audio/mp4', 'application/pdf', 'text/plain', 'text/csv',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            )
          )
        )
        and (
          p_category is null
          or (p_category = 'media' and (
            attachment.kind = 'image' or attachment.stored_mime_type = 'video/mp4'
          ))
          or (p_category = 'files' and attachment.kind = 'file'
            and attachment.stored_mime_type in (
              'application/pdf', 'text/plain', 'text/csv',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ))
          or (p_category = 'voice' and attachment.kind = 'file'
            and attachment.stored_mime_type = 'audio/mp4')
        )
        and (
          p_before_created_at is null
          or (
            message.created_at, message.id, 100 - attachment.position,
            ('attachment:' || attachment.id::text) collate "C"
          ) < (
            p_before_created_at, p_before_message_id, p_before_source_rank,
            p_before_item_id collate "C"
          )
        )
      order by message.created_at desc, message.id desc, (100 - attachment.position) desc,
        ('attachment:' || attachment.id::text) collate "C" desc
      limit (p_limit + 1)
    ) attachment_items
    union all
    select *
    from (
      select
        'gif:' || gif.message_id::text,
        message.conversation_id,
        message.id,
        message.sender_id,
        message.created_at,
        90,
        'media', 'gif',
        null::uuid, null::text, null::text, null::bigint, null::integer, null::integer,
        null::text, null::text,
        gif.provider, gif.provider_content_id, gif.title, gif.description,
        null::text, null::text, null::text, null::text, null::text, null::text,
        message.sender_id = (select auth.uid()), false
      from public.message_gifs gif
      join public.messages message on message.id = gif.message_id
      where (p_category is null or p_category = 'media')
        and message.conversation_id = p_conversation_id
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
        and (
          p_before_created_at is null
          or (message.created_at, message.id, 90, ('gif:' || gif.message_id::text) collate "C")
             < (p_before_created_at, p_before_message_id, p_before_source_rank, p_before_item_id collate "C")
        )
      order by message.created_at desc, message.id desc,
        ('gif:' || gif.message_id::text) collate "C" desc
      limit (p_limit + 1)
    ) gif_items
    union all
    select *
    from (
      select
        'sticker:' || message.id::text,
        message.conversation_id,
        message.id,
        message.sender_id,
        message.created_at,
        89,
        'media', 'sticker',
        null::uuid, null::text, null::text, null::bigint, null::integer, null::integer,
        null::text, null::text,
        null::text, null::text, null::text, null::text,
        message.sticker_id, null::text, null::text, null::text, null::text, null::text,
        message.sender_id = (select auth.uid()), false
      from public.messages message
      where (p_category is null or p_category = 'media')
        and message.conversation_id = p_conversation_id
        and message.deleted_at is null
        and message.sticker_id is not null
        and private.is_conversation_member(message.conversation_id)
        and (
          p_before_created_at is null
          or (message.created_at, message.id, 89, ('sticker:' || message.id::text) collate "C")
             < (p_before_created_at, p_before_message_id, p_before_source_rank, p_before_item_id collate "C")
        )
      order by message.created_at desc, message.id desc,
        ('sticker:' || message.id::text) collate "C" desc
      limit (p_limit + 1)
    ) sticker_items
    union all
    select *
    from (
      select
        'link:' || preview.message_id::text,
        message.conversation_id,
        message.id,
        message.sender_id,
        message.created_at,
        80,
        'links', 'link',
        null::uuid, null::text, null::text, null::bigint, null::integer, null::integer,
        null::text, null::text,
        null::text, null::text, null::text, null::text,
        null::text, preview.url, preview.hostname, preview.title, preview.description, preview.site_name,
        message.sender_id = (select auth.uid()), true
      from public.message_link_previews preview
      join public.messages message on message.id = preview.message_id
      where (p_category is null or p_category = 'links')
        and message.conversation_id = p_conversation_id
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
        and private.is_canonical_safe_link_identity(
          preview.url, preview.hostname,
          preview.safe_link_validation_version, preview.safe_link_validated_at
        )
        and (
          p_before_created_at is null
          or (message.created_at, message.id, 80, ('link:' || preview.message_id::text) collate "C")
             < (p_before_created_at, p_before_message_id, p_before_source_rank, p_before_item_id collate "C")
        )
      order by message.created_at desc, message.id desc,
        ('link:' || preview.message_id::text) collate "C" desc
      limit (p_limit + 1)
    ) link_items
  ), filtered as (
    select *
    from eligible
    where (p_category is null or eligible.category = p_category)
  )
  select *
  from filtered
  order by filtered.source_created_at desc, filtered.source_message_id desc,
    filtered.source_rank desc, filtered.item_id collate "C" desc
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
  select categories.category
  from (
    select 'media'::text as category
    where exists (
      select 1
      from public.message_attachments attachment
      join public.messages message on message.id = attachment.message_id
      where attachment.conversation_id = p_conversation_id
        and message.conversation_id = p_conversation_id
        and attachment.delete_requested_at is null
        and attachment.status = 'ready'
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
        and (
          (attachment.kind = 'image' and attachment.stored_mime_type = 'image/webp')
          or (attachment.kind = 'file' and attachment.stored_mime_type = 'video/mp4')
        )
      limit 1
    ) or exists (
      select 1
      from public.message_gifs gif
      join public.messages message on message.id = gif.message_id
      where message.conversation_id = p_conversation_id
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
      limit 1
    ) or exists (
      select 1 from public.messages message
      where message.conversation_id = p_conversation_id
        and message.deleted_at is null
        and message.sticker_id is not null
        and private.is_conversation_member(message.conversation_id)
      limit 1
    )
    union all
    select 'files'::text
    where exists (
      select 1
      from public.message_attachments attachment
      join public.messages message on message.id = attachment.message_id
      where attachment.conversation_id = p_conversation_id
        and message.conversation_id = p_conversation_id
        and attachment.delete_requested_at is null
        and attachment.status = 'ready'
        and attachment.kind = 'file'
        and attachment.stored_mime_type in (
          'application/pdf', 'text/plain', 'text/csv',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
      limit 1
    )
    union all
    select 'links'::text
    where exists (
      select 1
      from public.message_link_previews preview
      join public.messages message on message.id = preview.message_id
      where message.conversation_id = p_conversation_id
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
        and private.is_canonical_safe_link_identity(
          preview.url, preview.hostname,
          preview.safe_link_validation_version, preview.safe_link_validated_at
        )
      limit 1
    )
    union all
    select 'voice'::text
    where exists (
      select 1
      from public.message_attachments attachment
      join public.messages message on message.id = attachment.message_id
      where attachment.conversation_id = p_conversation_id
        and message.conversation_id = p_conversation_id
        and attachment.delete_requested_at is null
        and attachment.status = 'ready'
        and attachment.kind = 'file'
        and attachment.stored_mime_type = 'audio/mp4'
        and message.deleted_at is null
        and private.is_conversation_member(message.conversation_id)
      limit 1
    )
  ) categories
  order by case categories.category
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
      and message.deleted_at is null
      and (message.created_at, message.id) < (v_target.created_at, v_target.id)
    order by message.created_at desc, message.id desc
    limit (p_before + 1)
    offset p_before
  ) into v_has_older_gap;

  select exists (
    select 1
    from public.messages message
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and (message.created_at, message.id) > (v_target.created_at, v_target.id)
    order by message.created_at asc, message.id asc
    limit 1 offset p_after
  ) into v_has_newer_gap;

  return query
  with older as (
    select message.*
    from public.messages message
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and (message.created_at, message.id) < (v_target.created_at, v_target.id)
    order by message.created_at desc, message.id desc
    limit p_before
  ), newer as (
    select message.*
    from public.messages message
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
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
