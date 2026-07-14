-- Keep direct-conversation discovery member-scoped without granting friends
-- whole-row access to each other's profiles.

drop policy if exists "friends read each other" on public.profiles;

drop function if exists public.list_conversation_member_profiles(uuid[]);

create function public.list_conversation_member_profiles(
  p_conversation_ids uuid[]
)
returns table (
  conversation_id uuid,
  id uuid,
  role text,
  display_name text,
  username text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(cardinality(p_conversation_ids), 0) > 100 then
    raise exception 'too many conversations';
  end if;

  return query
  select distinct
    channel.conversation_id,
    profile.id,
    profile.role,
    profile.display_name,
    profile.username
  from public.channels channel
  join public.channel_members member on member.channel_id = channel.id
  join public.profiles profile on profile.id = member.user_id
  where channel.conversation_id = any(
      coalesce(p_conversation_ids, array[]::uuid[])
    )
    and exists (
      select 1
      from public.channel_members viewer
      where viewer.channel_id = channel.id
        and viewer.user_id = v_user_id
    )
    and (
      profile.id = v_user_id
      or not private.is_blocked_pair(v_user_id, profile.id)
    )

  union

  select
    conversation.id,
    profile.id,
    profile.role,
    profile.display_name,
    profile.username
  from public.conversations conversation
  join public.profiles profile
    on profile.id in (conversation.client_id, conversation.coach_id)
  where conversation.id = any(
      coalesce(p_conversation_ids, array[]::uuid[])
    )
    and not exists (
      select 1
      from public.channels channel
      where channel.conversation_id = conversation.id
    )
    and private.is_conversation_member(conversation.id)
  order by 1, 4, 2;
end;
$$;

revoke execute on function public.list_conversation_member_profiles(uuid[]) from public;
grant execute on function public.list_conversation_member_profiles(uuid[]) to authenticated;

create or replace function public.list_direct_conversation_previews()
returns table (
  conversation_id uuid,
  participant_id uuid,
  participant_role text,
  participant_display_name text,
  latest_message_sender_id uuid,
  latest_message_text text,
  latest_message_created_at timestamptz,
  unread_count integer
)
language sql
security definer
stable
set search_path = ''
as $$
  with direct_conversations as (
    select
      conversation.id,
      case
        when conversation.client_id = (select auth.uid())
          then conversation.coach_id
        else conversation.client_id
      end as participant_id
    from public.conversations conversation
    where (select auth.uid()) in (
        conversation.client_id,
        conversation.coach_id
      )
      and not exists (
        select 1
        from public.channels channel
        where channel.conversation_id = conversation.id
      )
      and private.is_conversation_member(conversation.id)
  )
  select
    conversation.id,
    participant.id,
    participant.role,
    participant.display_name,
    latest.sender_id,
    case
      when latest.id is null then null
      when latest.deleted_at is not null then 'Message deleted'
      when char_length(btrim(latest.body)) > 96
        then substring(btrim(latest.body) from 1 for 95) || '…'
      when char_length(btrim(latest.body)) > 0 then btrim(latest.body)
      when latest.sticker_id is not null then 'Sticker'
      when gif.message_id is not null then 'GIF'
      when attachments.attachment_count = 1
        then case when attachments.file_count = 1 then 'File' else 'Image' end
      when attachments.attachment_count > 1 and attachments.file_count = 0
        then attachments.attachment_count::text || ' images'
      when attachments.attachment_count > 1
        then attachments.attachment_count::text || ' files'
      else ''
    end,
    latest.created_at,
    coalesce(unread.unread_count, 0)::integer
  from direct_conversations conversation
  join public.profiles participant on participant.id = conversation.participant_id
  left join lateral (
    select message.*
    from public.messages message
    where message.conversation_id = conversation.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  left join public.message_gifs gif on gif.message_id = latest.id
  left join lateral (
    select
      count(*)::integer as attachment_count,
      count(*) filter (where attachment.kind = 'file')::integer as file_count
    from public.message_attachments attachment
    where attachment.message_id = latest.id
      and attachment.status = 'ready'
  ) attachments on true
  left join lateral (
    select count(message.id)::integer as unread_count
    from public.messages message
    left join public.message_reads read_state
      on read_state.conversation_id = conversation.id
      and read_state.user_id = (select auth.uid())
    left join public.messages read_message
      on read_message.id = read_state.last_read_message_id
    where message.conversation_id = conversation.id
      and message.sender_id <> (select auth.uid())
      and message.deleted_at is null
      and (
        read_message.id is null
        or (message.created_at, message.id) > (
          read_message.created_at,
          read_message.id
        )
      )
  ) unread on true
  order by
    coalesce(unread.unread_count, 0) desc,
    latest.created_at desc nulls last,
    conversation.id;
$$;

revoke execute on function public.list_direct_conversation_previews() from public;
grant execute on function public.list_direct_conversation_previews() to authenticated;

create or replace function public.list_navigation_attention()
returns table (
  surface text,
  entity_id uuid,
  conversation_id uuid,
  unread_count integer,
  mention_count integer,
  new_activity boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  with member_surfaces as (
    select
      'channel'::text as surface,
      channel.id as entity_id,
      channel.conversation_id
    from public.channels channel
    join public.channel_members member on member.channel_id = channel.id
    where member.user_id = (select auth.uid())

    union all

    select
      'direct'::text,
      conversation.id,
      conversation.id
    from public.conversations conversation
    where (select auth.uid()) in (
        conversation.client_id,
        conversation.coach_id
      )
      and not exists (
        select 1
        from public.channels channel
        where channel.conversation_id = conversation.id
      )
      and private.is_conversation_member(conversation.id)
  ),
  unread as (
    select
      member.surface,
      member.entity_id,
      member.conversation_id,
      count(message.id)::integer as unread_count,
      count(message.id) filter (
        where exists (
          select 1
          from public.message_mentions mention
          where mention.message_id = message.id
            and mention.mentioned_user_id = (select auth.uid())
        )
      )::integer as mention_count
    from member_surfaces member
    left join public.message_reads read_state
      on read_state.conversation_id = member.conversation_id
      and read_state.user_id = (select auth.uid())
    left join public.messages read_message
      on read_message.id = read_state.last_read_message_id
    left join public.messages message
      on message.conversation_id = member.conversation_id
      and message.sender_id <> (select auth.uid())
      and message.deleted_at is null
      and (
        read_message.id is null
        or (message.created_at, message.id) > (
          read_message.created_at,
          read_message.id
        )
      )
    group by member.surface, member.entity_id, member.conversation_id
  )
  select
    unread.surface,
    unread.entity_id,
    unread.conversation_id,
    unread.unread_count,
    unread.mention_count,
    unread.unread_count > 0
  from unread

  union all

  select
    'friends'::text,
    null::uuid,
    null::uuid,
    count(request.id)::integer,
    0,
    count(request.id) > 0
  from public.friend_requests request
  where request.recipient_id = (select auth.uid())
    and request.status = 'pending';
$$;
