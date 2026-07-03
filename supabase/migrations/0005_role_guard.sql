-- Role self-escalation guard (DB-04): defense-in-depth alongside handle_new_user's
-- hard-coded 'client' (0002). An authenticated user must never be able to change their
-- own role column; service_role callers (the seed script's D-12 reassignment path) must
-- still succeed, so the trigger's WHEN clause excludes them.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed by this caller';
  end if;
  return new;
end;
$$;

create trigger prevent_role_change
  before update on public.profiles
  for each row
  when (auth.role() = 'authenticated') -- service_role calls bypass this WHEN clause
  execute function public.prevent_role_self_escalation();
