-- One authoritative unread total for mobile badges and push payloads. The
-- direct-chat clients intentionally do not include channels in this total.
create or replace function public.get_mobile_unread_count(p_user_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null and (select auth.role()) <> 'service_role' then
    raise exception 'not authenticated';
  end if;
  if (select auth.role()) <> 'service_role' and p_user_id <> caller_id then
    raise exception 'not authorized';
  end if;

  return coalesce((
    select sum(unread.unread_count)::integer
    from (
      select count(message.id)::integer as unread_count
      from public.conversations conversation
      left join public.message_reads read_state
        on read_state.conversation_id = conversation.id
       and read_state.user_id = p_user_id
      left join public.messages read_message
        on read_message.id = read_state.last_read_message_id
      left join public.messages message
        on message.conversation_id = conversation.id
       and message.sender_id <> p_user_id
       and message.deleted_at is null
       and (
         read_message.id is null
         or (message.created_at, message.id) > (
           read_message.created_at,
           read_message.id
         )
       )
      where p_user_id in (conversation.client_id, conversation.coach_id)
        and not exists (
          select 1
          from public.channels channel
          where channel.conversation_id = conversation.id
        )
      group by conversation.id
    ) unread
  ), 0);
end;
$$;

revoke execute on function public.get_mobile_unread_count(uuid) from public;
grant execute on function public.get_mobile_unread_count(uuid) to authenticated, service_role;
