-- Blocking is a reversible safety action. Expose only the blocker's own safe
-- profile view so the app can provide a calm unblock path.

create or replace function public.list_blocked_users()
returns table (
  user_id uuid,
  display_name text,
  username text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
begin
  return query
  select p.id, p.display_name, p.username
  from public.user_blocks ub
  join public.profiles p on p.id = ub.blocked_id
  where ub.blocker_id = v_user_id
  order by ub.created_at desc, ub.blocked_id desc;
end;
$$;

revoke execute on function public.list_blocked_users() from public;
grant execute on function public.list_blocked_users() to authenticated;
