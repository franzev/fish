-- Surface each conversation's quiet state in the list preview, so a quiet
-- conversation does not look identical to one nobody has written in.
--
-- Only the two output columns are new. The ordering is deliberately unchanged:
-- going quiet silences the alert, it does not push the conversation down the
-- list.

drop function if exists public.list_direct_conversation_previews();

create function public.list_direct_conversation_previews()
returns table (
  conversation_id uuid,
  participant_id uuid,
  participant_role text,
  participant_display_name text,
  latest_message_sender_id uuid,
  latest_message_text text,
  latest_message_created_at timestamptz,
  unread_count integer,
  muted boolean,
  muted_until timestamptz
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
    coalesce(unread.unread_count, 0)::integer,
    mute.muted,
    mute.muted_until
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
  -- Reuses the single quiet predicate rather than repeating it here, so this
  -- projection can never drift from what conversation_mute reports.
  left join lateral (
    select state.muted, state.muted_until
    from private.conversation_mute_state(conversation.id, (select auth.uid())) state
  ) mute on true
  order by
    coalesce(unread.unread_count, 0) desc,
    latest.created_at desc nulls last,
    conversation.id;
$$;

revoke execute on function public.list_direct_conversation_previews() from public;
grant execute on function public.list_direct_conversation_previews() to authenticated;
