-- Completed calls are durable call history, not attention that needs to occupy
-- the notification center. Keep missed calls actionable, but stop projecting
-- connected call endings into notification items.

create or replace function public.sync_call_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  if tg_op <> 'UPDATE' or new.status = old.status then return new; end if;

  if new.status = 'missed' then
    v_recipient_id := case
      when new.initiated_by = new.coach_id then new.client_id
      else new.coach_id
    end;
    perform private.emit_notification_event(
      v_recipient_id,
      'call_missed',
      'direct',
      'missed-calls:' || new.initiated_by::text || ':' ||
        to_char(coalesce(new.ended_at, new.updated_at) at time zone 'UTC', 'YYYY-MM-DD'),
      'call-missed:' || new.id::text,
      new.initiated_by,
      null,
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

-- Remove already-projected completed calls from every recipient's active
-- notification list. The rows remain archived for audit/history purposes.
update public.notification_items
set archived_at = coalesce(archived_at, now()),
    archive_batch_id = null,
    change_seq = nextval('public.notification_change_seq'),
    updated_at = now()
where kind = 'call_completed'
  and archived_at is null;
