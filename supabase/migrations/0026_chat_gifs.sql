-- Provider-hosted GIF messages. Media remains on the provider CDN; FISH
-- stores the durable provider identity, attribution, accessibility copy, and
-- renditions needed to render chat history without using private uploads.

create table public.message_gifs (
  message_id uuid primary key references public.messages (id) on delete cascade,
  provider text not null check (provider in ('klipy', 'giphy')),
  provider_content_id text not null check (char_length(provider_content_id) between 1 and 200),
  title text not null check (char_length(title) between 1 and 300),
  description text not null check (char_length(description) between 1 and 500),
  source_url text not null check (char_length(source_url) between 1 and 2000),
  poster_url text not null check (char_length(poster_url) between 1 and 2000),
  preview_url text not null check (char_length(preview_url) between 1 and 2000),
  media_url text not null check (char_length(media_url) between 1 and 2000),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  created_at timestamptz not null default now()
);

alter table public.message_gifs enable row level security;
grant select on public.message_gifs to authenticated;
grant select, insert, update, delete on public.message_gifs to service_role;

create policy "members read message gifs"
  on public.message_gifs for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_gifs.message_id
        and m.deleted_at is null
        and private.is_conversation_member(m.conversation_id)
    )
  );

drop function if exists public.send_chat_message(uuid, text, text, uuid, uuid[]);

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_request_id text,
  p_reply_to_message_id uuid default null,
  p_attachment_ids uuid[] default '{}'::uuid[],
  p_gif jsonb default null
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
  if char_length(p_body) > 4000 then raise exception 'message body is too long'; end if;
  if cardinality(p_attachment_ids) > 5 then raise exception 'too many images'; end if;
  if p_gif is not null and cardinality(p_attachment_ids) > 0 then
    raise exception 'gif cannot be combined with attachments';
  end if;
  if char_length(p_body) = 0 and cardinality(p_attachment_ids) = 0 and p_gif is null then
    raise exception 'message content is required';
  end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id)) = 0 then
    raise exception 'client_request_id is required';
  end if;
  if cardinality(p_attachment_ids) <> (
    select count(distinct attachment_id) from unnest(p_attachment_ids) attachment_id
  ) then raise exception 'duplicate image'; end if;

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
    conversation_id, sender_id, sender_role, body, client_request_id, reply_to_message_id
  ) values (
    p_conversation_id, v_sender_id, v_sender_role, p_body,
    btrim(p_client_request_id), p_reply_to_message_id
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

revoke execute on function public.send_chat_message(uuid, text, text, uuid, uuid[], jsonb) from public;
grant execute on function public.send_chat_message(uuid, text, text, uuid, uuid[], jsonb) to authenticated;

create table public.message_gif_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.message_gifs (message_id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null default 'offensive' check (reason in ('offensive', 'broken', 'other')),
  created_at timestamptz not null default now(),
  constraint message_gif_reports_reporter_unique unique (message_id, reporter_id)
);

alter table public.message_gif_reports enable row level security;
grant select on public.message_gif_reports to authenticated;
grant select, insert, update, delete on public.message_gif_reports to service_role;

create policy "users read own gif reports"
  on public.message_gif_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

create or replace function public.report_message_gif(p_message_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  select m.conversation_id into v_conversation_id
  from public.messages m
  join public.message_gifs g on g.message_id = m.id
  where m.id = p_message_id and m.deleted_at is null;
  if v_conversation_id is null or not private.is_conversation_member(v_conversation_id) then
    raise exception 'gif message not found';
  end if;
  insert into public.message_gif_reports (message_id, reporter_id)
  values (p_message_id, v_user_id)
  on conflict on constraint message_gif_reports_reporter_unique do nothing;
  return true;
end;
$$;

revoke execute on function public.report_message_gif(uuid) from public;
grant execute on function public.report_message_gif(uuid) to authenticated;
