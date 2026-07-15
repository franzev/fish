-- Resolve the other participant's display name without reopening broad profile
-- visibility between friends. Only a participant in the requested call receives
-- a name; unrelated callers receive null.

create function public.get_call_counterpart_name(p_call_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select counterpart.display_name
  from public.calls call_record
  join public.profiles counterpart
    on counterpart.id = case
      when call_record.coach_id = (select auth.uid())
        then call_record.client_id
      else call_record.coach_id
    end
  where call_record.id = p_call_id
    and (select auth.uid()) in (
      call_record.coach_id,
      call_record.client_id
    );
$$;

revoke execute on function public.get_call_counterpart_name(uuid) from public;
grant execute on function public.get_call_counterpart_name(uuid) to authenticated;
