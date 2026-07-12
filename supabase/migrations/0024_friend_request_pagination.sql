-- Incoming requests are cursor-paginated, counted independently, and
-- addressable by id within the recipient's own pending set. No valid request
-- can become unreachable merely because newer requests arrived first.

drop function public.list_incoming_friend_requests();

create or replace function public.list_incoming_friend_requests(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  request_id uuid,
  sender_id uuid,
  display_name text,
  username text,
  created_at timestamptz
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
  select fr.id, p.id, p.display_name, p.username, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.sender_id
  where fr.recipient_id = v_user_id
    and fr.status = 'pending'
    and (
      p_cursor_created_at is null
      or (fr.created_at, fr.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by fr.created_at desc, fr.id desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.get_incoming_friend_request(p_request_id uuid)
returns table (
  request_id uuid,
  sender_id uuid,
  display_name text,
  username text,
  created_at timestamptz
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
  select fr.id, p.id, p.display_name, p.username, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.sender_id
  where fr.id = p_request_id
    and fr.recipient_id = v_user_id
    and fr.status = 'pending'
  limit 1;
end;
$$;

create or replace function public.count_incoming_friend_requests()
returns integer
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.friend_requests fr
  where fr.recipient_id = v_user_id and fr.status = 'pending';
  return v_count;
end;
$$;

revoke execute on function public.list_incoming_friend_requests(
  timestamptz, uuid, integer
) from public;
revoke execute on function public.get_incoming_friend_request(uuid) from public;
revoke execute on function public.count_incoming_friend_requests() from public;
grant execute on function public.list_incoming_friend_requests(
  timestamptz, uuid, integer
) to authenticated;
grant execute on function public.get_incoming_friend_request(uuid) to authenticated;
grant execute on function public.count_incoming_friend_requests() to authenticated;
