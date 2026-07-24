-- Voice duration is trusted nullable listing metadata. Existing attachments
-- remain valid without it, and conversation members retain read-only access.

alter table public.message_attachments
  add column duration_ms bigint;

alter table public.message_attachments
  add constraint message_attachments_duration_ms_non_negative_check
  check (duration_ms is null or duration_ms >= 0);

-- Authenticated callers may issue the same generic update shape as other
-- clients, while the absence of an UPDATE policy keeps every row inaccessible.
grant update (duration_ms) on public.message_attachments to authenticated;

drop function public.list_conversation_shared_content(
  uuid, text, timestamptz, uuid, integer, text, integer
);

create function public.list_conversation_shared_content(
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
  duration_ms bigint,
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
    duration_ms,
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
        case
          when attachment.stored_mime_type = 'audio/mp4' then attachment.duration_ms
          else null::bigint
        end,
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
        null::text, null::text, null::bigint,
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
        null::text, null::text, null::bigint,
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
        null::text, null::text, null::bigint,
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

revoke execute on function public.list_conversation_shared_content(
  uuid, text, timestamptz, uuid, integer, text, integer
) from public, anon;
grant execute on function public.list_conversation_shared_content(
  uuid, text, timestamptz, uuid, integer, text, integer
) to authenticated;
