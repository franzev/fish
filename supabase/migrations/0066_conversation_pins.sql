-- One pinned message per conversation. The primary key enforces "at most one
-- pin" without application-level locking; deleting the pinned message or the
-- conversation cascades the pin away with no tombstone to clean up.
create table public.conversation_pins (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  pinned_by uuid not null references public.profiles (id) on delete cascade,
  pinned_at timestamptz not null default now()
);

alter table public.conversation_pins enable row level security;

revoke all on public.conversation_pins from public, anon, authenticated;
grant select on public.conversation_pins to authenticated;
grant all on public.conversation_pins to service_role;

drop policy if exists "members read conversation pins" on public.conversation_pins;
create policy "members read conversation pins"
  on public.conversation_pins
  for select to authenticated
  using (private.is_conversation_member(conversation_id));

alter publication supabase_realtime add table public.conversation_pins;

-- Sets or clears the conversation's pin. A null message id unpins. Writes are
-- security-definer so the row insert/delete bypasses RLS while auth.uid() and
-- membership are still checked here, the same shape as set_conversation_mute.
create or replace function public.set_pinned_message(
  p_conversation_id uuid,
  p_message_id uuid
)
returns public.conversation_pins
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_message public.messages%rowtype;
  v_pin public.conversation_pins%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_conversation_id is null or not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;

  if p_message_id is null then
    delete from public.conversation_pins where conversation_id = p_conversation_id;
    return null;
  end if;

  v_message := private.assert_chat_message_member(p_message_id);

  if v_message.conversation_id <> p_conversation_id
    or v_message.deleted_at is not null
    or char_length(btrim(v_message.body)) = 0
  then
    raise exception 'message not found';
  end if;

  insert into public.conversation_pins as pin (conversation_id, message_id, pinned_by)
  values (p_conversation_id, p_message_id, v_user_id)
  on conflict on constraint conversation_pins_pkey do update
    set message_id = excluded.message_id,
        pinned_by = excluded.pinned_by,
        pinned_at = now()
  returning * into v_pin;

  return v_pin;
end;
$$;

revoke execute on function public.set_pinned_message(uuid, uuid) from public;
grant execute on function public.set_pinned_message(uuid, uuid) to authenticated;
