-- Any-emoji reactions: the 4-emoji whitelist (introduced in 0013) blocks the
-- redesigned emoji picker, which lets clients/coaches react with any emoji
-- (including multi-codepoint ZWJ/skin-tone sequences). Relax the check
-- constraint and RPC to a generic length bound instead of an enum, keeping
-- the same `'reaction is not supported'` exception text so the edge
-- function's calm error mapping is unaffected.

alter table public.message_reactions
  drop constraint message_reactions_emoji_supported;

alter table public.message_reactions
  add constraint message_reactions_emoji_supported
  check (char_length(btrim(emoji)) between 1 and 16);

create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns public.messages
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_message public.messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_emoji is null or btrim(p_emoji) = '' or char_length(p_emoji) > 16 then
    raise exception 'reaction is not supported';
  end if;

  v_message := private.assert_chat_message_member(p_message_id);

  if v_message.deleted_at is not null then
    raise exception 'message is deleted';
  end if;

  if exists (
    select 1
    from public.message_reactions r
    where r.message_id = p_message_id
      and r.user_id = v_user_id
      and r.emoji = p_emoji
      and r.removed_at is null
  ) then
    update public.message_reactions r
    set removed_at = now()
    where r.message_id = p_message_id
      and r.user_id = v_user_id
      and r.emoji = p_emoji
      and r.removed_at is null;
  else
    insert into public.message_reactions (
      conversation_id,
      message_id,
      user_id,
      emoji
    )
    values (
      v_message.conversation_id,
      p_message_id,
      v_user_id,
      p_emoji
    )
    on conflict (message_id, user_id, emoji)
    do update set
      conversation_id = excluded.conversation_id,
      removed_at = null,
      created_at = now();
  end if;

  return v_message;
end;
$$;
