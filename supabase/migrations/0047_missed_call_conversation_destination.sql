-- A missed call is already over, so reopening its call room is a dead end.
-- Attach the pair's direct conversation instead, where the recipient can
-- reply or start a new call.

create or replace function public.sync_call_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_conversation_id uuid;
begin
  if tg_op <> 'UPDATE' or new.status = old.status then return new; end if;

  if new.status = 'missed' then
    v_recipient_id := case
      when new.initiated_by = new.coach_id then new.client_id
      else new.coach_id
    end;

    select conversation.id into v_conversation_id
    from public.conversations conversation
    where conversation.coach_id = new.coach_id
      and conversation.client_id = new.client_id
    limit 1;

    perform private.emit_notification_event(
      v_recipient_id,
      'call_missed',
      'direct',
      'missed-calls:' || new.initiated_by::text || ':' ||
        to_char(coalesce(new.ended_at, new.updated_at) at time zone 'UTC', 'YYYY-MM-DD'),
      'call-missed:' || new.id::text,
      new.initiated_by,
      v_conversation_id,
      null,
      new.id,
      null,
      null,
      null,
      '{}'::jsonb,
      coalesce(new.ended_at, new.updated_at),
      false
    );
  end if;
  return new;
end;
$$;

update public.notification_events event
set conversation_id = conversation.id
from public.calls call,
     public.conversations conversation
where event.kind = 'call_missed'
  and event.call_id = call.id
  and event.conversation_id is null
  and conversation.coach_id = call.coach_id
  and conversation.client_id = call.client_id;

update public.notification_items item
set change_seq = nextval('public.notification_change_seq'),
    updated_at = now()
where item.archived_at is null
  and exists (
    select 1
    from public.notification_events event
    where event.id = item.latest_event_id
      and event.kind = 'call_missed'
      and event.conversation_id is not null
  );
