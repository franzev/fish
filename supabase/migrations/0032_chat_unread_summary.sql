-- Exact unread metadata for the active conversation. The chat transcript is
-- intentionally loaded in bounded pages, so client-side counting alone cannot
-- reliably describe unread history that starts outside the newest window.

create or replace function public.get_chat_unread_summary(
  p_conversation_id uuid
)
returns table (
  unread_count integer,
  oldest_unread_at timestamptz,
  latest_unread_message_id uuid
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

  if not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;

  return query
  with read_marker as (
    select marker.created_at, marker.id
    from public.message_reads read_state
    join public.messages marker
      on marker.id = read_state.last_read_message_id
    where read_state.conversation_id = p_conversation_id
      and read_state.user_id = v_user_id
  ),
  unread as (
    select message.id, message.created_at
    from public.messages message
    left join read_marker marker on true
    where message.conversation_id = p_conversation_id
      and message.sender_id <> v_user_id
      and message.deleted_at is null
      and (
        marker.id is null
        or (message.created_at, message.id) > (marker.created_at, marker.id)
      )
  )
  select
    count(*)::integer,
    min(unread.created_at),
    (array_agg(unread.id order by unread.created_at desc, unread.id desc))[1]
  from unread;
end;
$$;

revoke execute on function public.get_chat_unread_summary(uuid) from public;
grant execute on function public.get_chat_unread_summary(uuid) to authenticated;
