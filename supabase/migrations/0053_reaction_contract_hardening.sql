-- Make reaction writes idempotent for retrying clients and expose viewer-specific
-- summaries without sending reactor identities to every chat client.

create or replace function public.set_message_reaction(
  p_message_id uuid,
  p_emoji text,
  p_active boolean
)
returns public.messages
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_emoji text := btrim(p_emoji);
  v_message public.messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_active is null then
    raise exception 'reaction state is required';
  end if;

  if v_emoji is null or v_emoji = '' or char_length(v_emoji) > 16 then
    raise exception 'reaction is not supported';
  end if;

  v_message := private.assert_chat_message_member(p_message_id);

  if v_message.deleted_at is not null then
    raise exception 'message is deleted';
  end if;

  if p_active then
    insert into public.message_reactions as existing (
      conversation_id,
      message_id,
      user_id,
      emoji
    )
    values (
      v_message.conversation_id,
      p_message_id,
      v_user_id,
      v_emoji
    )
    on conflict (message_id, user_id, emoji)
    do update set
      conversation_id = excluded.conversation_id,
      removed_at = null,
      created_at = case
        when existing.removed_at is null then existing.created_at
        else now()
      end;
  else
    update public.message_reactions reaction
    set removed_at = now()
    where reaction.message_id = p_message_id
      and reaction.user_id = v_user_id
      and reaction.emoji = v_emoji
      and reaction.removed_at is null;
  end if;

  return v_message;
end;
$$;

create or replace function public.list_message_reaction_summaries(
  p_message_ids uuid[]
)
returns table (
  message_id uuid,
  emoji text,
  count integer,
  by_me boolean,
  first_created_at timestamptz
)
language plpgsql
security invoker
stable
set search_path = ''
as $$
begin
  if p_message_ids is null
    or cardinality(p_message_ids) < 1
    or cardinality(p_message_ids) > 50
  then
    raise exception 'reaction summary message count is not supported';
  end if;

  return query
  select
    reaction.message_id,
    reaction.emoji,
    count(*)::integer,
    bool_or(reaction.user_id = (select auth.uid())),
    min(reaction.created_at)
  from public.message_reactions reaction
  where reaction.message_id = any (p_message_ids)
    and reaction.removed_at is null
  group by reaction.message_id, reaction.emoji
  order by min(reaction.created_at), reaction.emoji;
end;
$$;

revoke execute on function public.set_message_reaction(uuid, text, boolean) from public;
revoke execute on function public.list_message_reaction_summaries(uuid[]) from public;

grant execute on function public.set_message_reaction(uuid, text, boolean) to authenticated;
grant execute on function public.list_message_reaction_summaries(uuid[]) to authenticated;
