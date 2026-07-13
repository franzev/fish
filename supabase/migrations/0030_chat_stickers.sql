-- Bundled stickers are referenced by stable catalog ids. The image stays in
-- the web application, so sending a sticker never creates an upload.

alter table public.messages
  add column sticker_id text;

alter table public.messages
  add constraint messages_sticker_id_check check (
    sticker_id is null or sticker_id in (
      'aquatic-thank-you-octopus',
      'aquatic-good-night-whale',
      'aquatic-great-job-sea-star',
      'aquatic-hello-otter',
      'aquatic-awesome-dolphin',
      'aquatic-see-you-soon-turtle',
      'aquatic-youre-welcome-seal',
      'aquatic-goodbye-squid',
      'aquatic-good-morning-seahorse',
      'aquatic-congratulations-jellyfish',
      'aquatic-sorry-penguin',
      'aquatic-please-shrimp',
      'aquatic-yes-crab',
      'aquatic-no-lobster',
      'aquatic-okay-manta-ray',
      'aquatic-good-luck-goldfish',
      'aquatic-happy-birthday-narwhal',
      'aquatic-i-miss-you-manatee',
      'aquatic-love-you-angelfish',
      'aquatic-lol-clownfish',
      'aquatic-omg-pufferfish',
      'aquatic-cheers-walrus',
      'aquatic-welcome-back-sea-lion',
      'aquatic-nice-nudibranch'
    )
  );

drop function if exists public.send_chat_message(uuid, text, text, uuid, uuid[], jsonb);

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_request_id text,
  p_reply_to_message_id uuid default null,
  p_attachment_ids uuid[] default '{}'::uuid[],
  p_gif jsonb default null,
  p_sticker_id text default null
)
returns public.messages
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_sender_id uuid := (select auth.uid());
  v_sender_role text;
  v_conversation public.conversations%rowtype;
  v_existing public.messages%rowtype;
  v_message public.messages%rowtype;
  v_attachment_count integer;
  v_existing_attachment_ids uuid[];
  v_existing_gif jsonb;
  v_provider text;
  v_source_url text;
  v_poster_url text;
  v_preview_url text;
  v_media_url text;
begin
  if v_sender_id is null then raise exception 'not authenticated'; end if;
  p_body := btrim(coalesce(p_body, ''));
  p_attachment_ids := coalesce(p_attachment_ids, '{}'::uuid[]);
  p_sticker_id := nullif(btrim(coalesce(p_sticker_id, '')), '');
  if char_length(p_body) > 4000 then raise exception 'message body is too long'; end if;
  if cardinality(p_attachment_ids) > 5 then raise exception 'too many images'; end if;
  if p_gif is not null and cardinality(p_attachment_ids) > 0 then
    raise exception 'gif cannot be combined with attachments';
  end if;
  if p_sticker_id is not null and (p_gif is not null or cardinality(p_attachment_ids) > 0) then
    raise exception 'sticker cannot be combined with other media';
  end if;
  if char_length(p_body) = 0 and cardinality(p_attachment_ids) = 0
    and p_gif is null and p_sticker_id is null
  then
    raise exception 'message content is required';
  end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id)) = 0 then
    raise exception 'client_request_id is required';
  end if;
  if cardinality(p_attachment_ids) <> (
    select count(distinct attachment_id) from unnest(p_attachment_ids) attachment_id
  ) then raise exception 'duplicate image'; end if;

  if p_sticker_id is not null and p_sticker_id not in (
    'aquatic-thank-you-octopus',
    'aquatic-good-night-whale',
    'aquatic-great-job-sea-star',
    'aquatic-hello-otter',
    'aquatic-awesome-dolphin',
    'aquatic-see-you-soon-turtle',
    'aquatic-youre-welcome-seal',
    'aquatic-goodbye-squid',
    'aquatic-good-morning-seahorse',
    'aquatic-congratulations-jellyfish',
    'aquatic-sorry-penguin',
    'aquatic-please-shrimp',
    'aquatic-yes-crab',
    'aquatic-no-lobster',
    'aquatic-okay-manta-ray',
    'aquatic-good-luck-goldfish',
    'aquatic-happy-birthday-narwhal',
    'aquatic-i-miss-you-manatee',
    'aquatic-love-you-angelfish',
    'aquatic-lol-clownfish',
    'aquatic-omg-pufferfish',
    'aquatic-cheers-walrus',
    'aquatic-welcome-back-sea-lion',
    'aquatic-nice-nudibranch'
  ) then
    raise exception 'sticker is not available';
  end if;

  if p_gif is not null then
    v_provider := p_gif->>'provider';
    v_source_url := p_gif->>'sourceUrl';
    v_poster_url := p_gif->>'posterUrl';
    v_preview_url := p_gif->>'previewUrl';
    v_media_url := p_gif->>'mediaUrl';
    if v_provider not in ('klipy', 'giphy')
      or char_length(coalesce(p_gif->>'providerId', '')) not between 1 and 200
      or char_length(coalesce(p_gif->>'title', '')) not between 1 and 300
      or char_length(coalesce(p_gif->>'description', '')) not between 1 and 500
      or coalesce((p_gif->>'width')::integer, 0) not between 1 and 4096
      or coalesce((p_gif->>'height')::integer, 0) not between 1 and 4096
    then raise exception 'gif metadata is invalid'; end if;

    if v_provider = 'klipy' and (
      v_source_url !~ '^https://([a-z0-9-]+\.)?klipy\.com/'
      or v_poster_url !~ '^https://static[0-9]*\.klipy\.com/'
      or v_preview_url !~ '^https://static[0-9]*\.klipy\.com/'
      or v_media_url !~ '^https://static[0-9]*\.klipy\.com/'
    ) then raise exception 'gif source is invalid'; end if;

    if v_provider = 'giphy' and (
      v_source_url !~ '^https://([a-z0-9-]+\.)?giphy\.com/'
      or v_poster_url !~ '^https://media[0-9]*\.giphy\.com/'
      or v_preview_url !~ '^https://media[0-9]*\.giphy\.com/'
      or v_media_url !~ '^https://media[0-9]*\.giphy\.com/'
    ) then raise exception 'gif source is invalid'; end if;
  end if;

  select * into v_conversation from public.conversations where id = p_conversation_id;
  if not found or not private.is_conversation_member(p_conversation_id) then
    raise exception 'conversation not found';
  end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from public.messages m where m.id = p_reply_to_message_id
      and m.conversation_id = p_conversation_id and m.deleted_at is null
  ) then raise exception 'reply target not found'; end if;
  select role into v_sender_role from public.profiles where id = v_sender_id;
  if v_sender_role is null then raise exception 'sender profile not found'; end if;

  select * into v_existing from public.messages m
  where m.conversation_id = p_conversation_id and m.client_request_id = btrim(p_client_request_id);
  if found then
    select coalesce(array_agg(a.id order by a.position), '{}'::uuid[])
      into v_existing_attachment_ids from public.message_attachments a where a.message_id = v_existing.id;
    select case when g.message_id is null then null else jsonb_build_object(
      'provider', g.provider, 'providerId', g.provider_content_id,
      'title', g.title, 'description', g.description, 'sourceUrl', g.source_url,
      'posterUrl', g.poster_url, 'previewUrl', g.preview_url, 'mediaUrl', g.media_url,
      'width', g.width, 'height', g.height
    ) end into v_existing_gif
    from (select v_existing.id as id) x
    left join public.message_gifs g on g.message_id = x.id;
    if v_existing.sender_id = v_sender_id and v_existing.body = p_body
      and v_existing.reply_to_message_id is not distinct from p_reply_to_message_id
      and v_existing_attachment_ids = p_attachment_ids
      and v_existing_gif is not distinct from p_gif
      and v_existing.sticker_id is not distinct from p_sticker_id
    then return v_existing; end if;
    raise exception 'client_request_id conflicts with an existing message';
  end if;

  if cardinality(p_attachment_ids) > 0 then
    perform 1 from public.message_attachments a where a.id = any(p_attachment_ids) for update;
    select count(*) into v_attachment_count from public.message_attachments a
    where a.id = any(p_attachment_ids) and a.conversation_id = p_conversation_id
      and a.uploader_id = v_sender_id and a.status = 'ready' and a.message_id is null
      and a.expires_at > now();
    if v_attachment_count <> cardinality(p_attachment_ids) then
      raise exception 'image attachment is not ready';
    end if;
  end if;

  insert into public.messages (
    conversation_id, sender_id, sender_role, body, client_request_id,
    reply_to_message_id, sticker_id
  ) values (
    p_conversation_id, v_sender_id, v_sender_role, p_body,
    btrim(p_client_request_id), p_reply_to_message_id, p_sticker_id
  ) returning * into v_message;

  update public.message_attachments a
  set message_id = v_message.id, position = ordered.ordinality - 1, updated_at = now(),
      expires_at = now() + interval '100 years'
  from unnest(p_attachment_ids) with ordinality ordered(id, ordinality)
  where a.id = ordered.id;

  if p_gif is not null then
    insert into public.message_gifs (
      message_id, provider, provider_content_id, title, description,
      source_url, poster_url, preview_url, media_url, width, height
    ) values (
      v_message.id, v_provider, p_gif->>'providerId', p_gif->>'title',
      p_gif->>'description', v_source_url, v_poster_url, v_preview_url,
      v_media_url, (p_gif->>'width')::integer, (p_gif->>'height')::integer
    );
  end if;

  update public.conversations set updated_at = now() where id = p_conversation_id;
  return v_message;
end;
$$;

revoke execute on function public.send_chat_message(uuid, text, text, uuid, uuid[], jsonb, text) from public;
grant execute on function public.send_chat_message(uuid, text, text, uuid, uuid[], jsonb, text) to authenticated;
