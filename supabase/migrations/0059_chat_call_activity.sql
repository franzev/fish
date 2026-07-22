-- Completed call rows are part of the direct-chat timeline, but remain a
-- separate read model so message search, unread counts, and read markers stay
-- message-only. Membership is checked inside a security-definer RPC rather
-- than trusting a client-supplied pair of user ids.

create or replace function public.get_conversation_call_activity(
  p_conversation_id uuid,
  p_before_ended_at timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  kind public.call_kind,
  status public.call_status,
  initiated_by uuid,
  created_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  end_reason public.call_end_reason
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    call_record.id,
    call_record.kind,
    call_record.status,
    call_record.initiated_by,
    call_record.created_at,
    call_record.connected_at,
    call_record.ended_at,
    call_record.end_reason
  from public.calls call_record
  join public.conversations conversation
    on (
      (conversation.coach_id = call_record.coach_id
       and conversation.client_id = call_record.client_id)
      or
      (conversation.coach_id = call_record.client_id
       and conversation.client_id = call_record.coach_id)
    )
  where conversation.id = p_conversation_id
    and private.is_conversation_member(p_conversation_id)
    and call_record.status in ('ended', 'rejected', 'cancelled', 'missed', 'failed')
    and (
      p_before_ended_at is null
      or call_record.ended_at < p_before_ended_at
    )
  order by call_record.ended_at desc, call_record.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.get_conversation_call_activity(uuid, timestamptz, integer) from public;
grant execute on function public.get_conversation_call_activity(uuid, timestamptz, integer) to authenticated;
