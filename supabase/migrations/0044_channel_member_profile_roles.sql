-- Include the profile role in the safe channel-member projection so member
-- quick views can distinguish coaches from clients without reading profiles.

drop function public.list_channel_member_profiles(uuid);

create function public.list_channel_member_profiles(p_channel_id uuid)
returns table (
  id uuid,
  display_name text,
  username text,
  role text
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
  if p_channel_id is null or not exists (
    select 1
    from public.channel_members viewer
    where viewer.channel_id = p_channel_id
      and viewer.user_id = v_user_id
  ) then
    raise exception 'channel unavailable';
  end if;

  return query
  select profile.id, profile.display_name, profile.username, profile.role
  from public.channel_members member
  join public.profiles profile on profile.id = member.user_id
  where member.channel_id = p_channel_id
    and (
      profile.id = v_user_id
      or not private.is_blocked_pair(v_user_id, profile.id)
    )
  order by profile.display_name, profile.id;
end;
$$;

revoke execute on function public.list_channel_member_profiles(uuid) from public;
grant execute on function public.list_channel_member_profiles(uuid) to authenticated;
