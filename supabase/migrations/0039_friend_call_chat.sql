-- Give accepted friends one persistent direct conversation so a video call can
-- expose the same chat surface as a coach-client call. Friend call rows already
-- store the lower UUID in coach_id and the higher UUID in client_id, matching
-- the stable ordering used here.

create or replace function private.is_conversation_member(conversation_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.channels channel
    join public.channel_members member on member.channel_id = channel.id
    where channel.conversation_id = conversation_uuid
      and member.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_uuid
      and (
        (
          conversation.client_id = (select auth.uid())
          and private.is_client_of(conversation.coach_id)
        )
        or (
          conversation.coach_id = (select auth.uid())
          and private.is_coach_of(conversation.client_id)
        )
        or (
          (select auth.uid()) in (
            conversation.client_id,
            conversation.coach_id
          )
          and private.are_friends(
            conversation.client_id,
            conversation.coach_id
          )
          and not private.is_blocked_pair(
            conversation.client_id,
            conversation.coach_id
          )
        )
      )
  );
$$;

create or replace function private.is_user_conversation_member(
  conversation_uuid uuid,
  user_uuid uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select user_uuid is not null and (
    exists (
      select 1
      from public.channels channel
      join public.channel_members member on member.channel_id = channel.id
      where channel.conversation_id = conversation_uuid
        and member.user_id = user_uuid
    )
    or exists (
      select 1
      from public.conversations conversation
      where conversation.id = conversation_uuid
        and user_uuid in (
          conversation.client_id,
          conversation.coach_id
        )
        and (
          exists (
            select 1
            from public.coach_clients assignment
            where assignment.coach_id = conversation.coach_id
              and assignment.client_id = conversation.client_id
          )
          or (
            private.are_friends(
              conversation.client_id,
              conversation.coach_id
            )
            and not private.is_blocked_pair(
              conversation.client_id,
              conversation.coach_id
            )
          )
        )
    )
  );
$$;

create or replace function private.ensure_friend_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (coach_id, client_id)
  values (new.user_low_id, new.user_high_id)
  on conflict on constraint conversations_client_coach_unique do nothing;

  return new;
end;
$$;

create trigger ensure_friend_conversation_trigger
  after insert on public.friendships
  for each row execute function private.ensure_friend_conversation();

-- Existing accepted friendships need the same conversation immediately.
insert into public.conversations (coach_id, client_id)
select friendship.user_low_id, friendship.user_high_id
from public.friendships friendship
on conflict on constraint conversations_client_coach_unique do nothing;
