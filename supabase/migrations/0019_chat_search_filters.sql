-- Production chat search: stable member handles, channel membership,
-- structured mentions, pin metadata, and one RLS-protected keyset RPC.

create extension if not exists pg_trgm with schema extensions;

alter table public.profiles add column username text;

update public.profiles
set username = lower(
  regexp_replace(
    coalesce(nullif(split_part(email, '@', 1), ''), 'member_' || left(id::text, 8)),
    '[^a-zA-Z0-9_]+',
    '_',
    'g'
  )
);

-- Existing emails are unique, but keep the migration safe for manually-created
-- profiles whose empty/fallback handles could collide.
with duplicates as (
  select id, username, row_number() over (partition by username order by id) as position
  from public.profiles
)
update public.profiles p
set username = p.username || '_' || left(p.id::text, 6)
from duplicates d
where p.id = d.id and d.position > 1;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format_check
    check (username ~ '^[a-z0-9_]{3,64}$'),
  add constraint profiles_username_unique unique (username);

-- Keep the hardened auth trigger in sync with the new required column. The
-- UUID suffix makes concurrent signups from different domains with the same
-- email local-part collision-safe without trusting user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
begin
  v_username := left(
    coalesce(
      nullif(lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]+', '_', 'g')), ''),
      'member'
    ),
    55
  ) || '_' || left(replace(new.id::text, '-', ''), 6);

  insert into public.profiles (id, role, display_name, email, username)
  values (
    new.id,
    'client',
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.email, ''),
    v_username
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

insert into public.channel_members (channel_id, user_id)
select distinct c.id, r.user_id
from public.channels c
join public.message_reads r on r.conversation_id = c.conversation_id
on conflict do nothing;

alter table public.channel_members enable row level security;
grant select on public.channel_members to authenticated;
grant select, insert, update, delete on public.channel_members to service_role;

create or replace function private.is_channel_member(channel_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.channel_members cm
    where cm.channel_id = channel_uuid and cm.user_id = (select auth.uid())
  );
$$;

create policy "channel members read shared membership"
  on public.channel_members for select to authenticated
  using (private.is_channel_member(channel_id));

alter table public.messages
  add column pinned_at timestamptz,
  add column pinned_by uuid references public.profiles (id) on delete set null,
  add constraint messages_pin_fields_check check (
    (pinned_at is null and pinned_by is null)
    or (pinned_at is not null and pinned_by is not null)
  );

create index messages_conversation_sender_created_idx
  on public.messages (conversation_id, sender_id, created_at desc, id desc);
create index messages_conversation_author_created_idx
  on public.messages (conversation_id, sender_role, created_at desc, id desc);
create index messages_pinned_idx
  on public.messages (conversation_id, pinned_at desc, id desc)
  where pinned_at is not null;
create index messages_body_search_idx
  on public.messages using gin (to_tsvector('simple', body));
create index messages_body_partial_search_idx
  on public.messages using gin (body extensions.gin_trgm_ops);

create table public.message_mentions (
  message_id uuid not null references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (message_id, mentioned_user_id)
);

create index message_mentions_conversation_user_message_idx
  on public.message_mentions (conversation_id, mentioned_user_id, message_id);

alter table public.message_mentions enable row level security;
grant select on public.message_mentions to authenticated;
grant select, insert, update, delete on public.message_mentions to service_role;

create policy "members read message mentions"
  on public.message_mentions for select to authenticated
  using (private.is_conversation_member(conversation_id));

create or replace function public.sync_message_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.message_mentions where message_id = new.id;

  if new.deleted_at is null then
    insert into public.message_mentions (message_id, conversation_id, mentioned_user_id)
    select distinct new.id, new.conversation_id, p.id
    from regexp_matches(
      lower(new.body),
      '(^|[^[:alnum:]_])@([a-z0-9_]{3,64})',
      'g'
    ) as matches(parts)
    join public.profiles p on p.username = matches.parts[2];
  end if;

  return new;
end;
$$;

create trigger sync_message_mentions_trigger
  after insert or update of body, deleted_at on public.messages
  for each row execute function public.sync_message_mentions();

-- Backfill mentions for messages created before the trigger.
update public.messages set body = body;

create table public.message_embeds (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  constraint message_embeds_url_check check (url ~* '^https?://')
);

create index message_embeds_message_idx on public.message_embeds (message_id);
alter table public.message_embeds enable row level security;
grant select on public.message_embeds to authenticated;
grant select, insert, update, delete on public.message_embeds to service_role;
create policy "members read message embeds"
  on public.message_embeds for select to authenticated
  using (private.is_conversation_member(conversation_id));

create or replace function private.filtered_chat_messages(
  p_conversation_id uuid,
  p_query text,
  p_sender_ids uuid[],
  p_mentioned_user_ids uuid[],
  p_channel_ids uuid[],
  p_content_kinds text[],
  p_author_types text[],
  p_pinned boolean,
  p_dates jsonb
)
returns setof public.messages
language sql
security invoker
stable
set search_path = ''
as $$
  select m.*
  from public.messages m
  where m.deleted_at is null
    and (
      (
        cardinality(p_channel_ids) = 0
        and m.conversation_id = p_conversation_id
      )
      or (
        cardinality(p_channel_ids) > 0
        and exists (
          select 1 from public.channels selected_channel
          where selected_channel.conversation_id = m.conversation_id
            and selected_channel.id = any(p_channel_ids)
        )
      )
    )
    and (
      btrim(coalesce(p_query, '')) = ''
      or to_tsvector('simple', m.body) @@ websearch_to_tsquery('simple', p_query)
      or m.body ilike '%' || p_query || '%'
    )
    and (cardinality(p_sender_ids) = 0 or m.sender_id = any(p_sender_ids))
    and (cardinality(p_author_types) = 0 or m.sender_role = any(p_author_types))
    and (
      cardinality(p_mentioned_user_ids) = 0
      or exists (
        select 1 from public.message_mentions mm
        where mm.message_id = m.id
          and mm.mentioned_user_id = any(p_mentioned_user_ids)
      )
    )
    and (
      cardinality(p_content_kinds) = 0
      or exists (
        select 1 from unnest(p_content_kinds) requested(kind)
        where case requested.kind
          when 'image' then exists (
            select 1 from public.message_attachments a
            where a.message_id = m.id and a.status = 'ready'
              and a.stored_mime_type like 'image/%'
          )
          when 'video' then exists (
            select 1 from public.message_attachments a
            where a.message_id = m.id and a.status = 'ready'
              and a.stored_mime_type like 'video/%'
          )
          when 'file' then exists (
            select 1 from public.message_attachments a
            where a.message_id = m.id and a.status = 'ready'
              and a.stored_mime_type not like 'image/%'
              and a.stored_mime_type not like 'video/%'
          )
          when 'link' then m.body ~* 'https?://'
          when 'embed' then exists (
            select 1 from public.message_embeds e where e.message_id = m.id
          )
          else false
        end
      )
    )
    and (
      p_pinned is null
      or (p_pinned and m.pinned_at is not null)
      or (not p_pinned and m.pinned_at is null)
    )
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_dates, '[]'::jsonb)) rule
      where not case rule->>'operator'
        when 'before' then
          m.created_at < ((rule->>'date')::date::timestamp at time zone coalesce(rule->>'timeZone', 'UTC'))
        when 'after' then
          m.created_at >= (((rule->>'date')::date + 1)::timestamp at time zone coalesce(rule->>'timeZone', 'UTC'))
        when 'during' then
          m.created_at >= ((rule->>'date')::date::timestamp at time zone coalesce(rule->>'timeZone', 'UTC'))
          and m.created_at < (((rule->>'date')::date + 1)::timestamp at time zone coalesce(rule->>'timeZone', 'UTC'))
        else false
      end
    )
$$;

revoke execute on function private.filtered_chat_messages(
  uuid, text, uuid[], uuid[], uuid[], text[], text[], boolean, jsonb
) from public;
grant usage on schema private to authenticated;
grant execute on function private.filtered_chat_messages(
  uuid, text, uuid[], uuid[], uuid[], text[], text[], boolean, jsonb
) to authenticated;

create or replace function public.search_chat_messages(
  p_conversation_id uuid,
  p_query text default '',
  p_sender_ids uuid[] default '{}'::uuid[],
  p_mentioned_user_ids uuid[] default '{}'::uuid[],
  p_channel_ids uuid[] default '{}'::uuid[],
  p_content_kinds text[] default '{}'::text[],
  p_author_types text[] default '{}'::text[],
  p_pinned boolean default null,
  p_dates jsonb default '[]'::jsonb,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_sort_direction text default 'desc'
)
returns setof public.messages
language sql
security invoker
stable
set search_path = ''
as $$
  select m.*
  from private.filtered_chat_messages(
    p_conversation_id,
    p_query,
    p_sender_ids,
    p_mentioned_user_ids,
    p_channel_ids,
    p_content_kinds,
    p_author_types,
    p_pinned,
    p_dates
  ) m
  where p_before_created_at is null
    or (
      p_sort_direction = 'desc'
      and (m.created_at, m.id) < (p_before_created_at, p_before_id)
    )
    or (
      p_sort_direction = 'asc'
      and (m.created_at, m.id) > (p_before_created_at, p_before_id)
    )
  order by
    case when p_sort_direction = 'asc' then m.created_at end asc,
    case when p_sort_direction = 'asc' then m.id end asc,
    case when p_sort_direction <> 'asc' then m.created_at end desc,
    case when p_sort_direction <> 'asc' then m.id end desc
  offset least(greatest(p_offset, 0), 1000000)
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.count_chat_messages(
  p_conversation_id uuid,
  p_query text default '',
  p_sender_ids uuid[] default '{}'::uuid[],
  p_mentioned_user_ids uuid[] default '{}'::uuid[],
  p_channel_ids uuid[] default '{}'::uuid[],
  p_content_kinds text[] default '{}'::text[],
  p_author_types text[] default '{}'::text[],
  p_pinned boolean default null,
  p_dates jsonb default '[]'::jsonb
)
returns bigint
language sql
security invoker
stable
set search_path = ''
as $$
  select count(*)
  from private.filtered_chat_messages(
    p_conversation_id,
    p_query,
    p_sender_ids,
    p_mentioned_user_ids,
    p_channel_ids,
    p_content_kinds,
    p_author_types,
    p_pinned,
    p_dates
  );
$$;

revoke execute on function public.search_chat_messages(
  uuid, text, uuid[], uuid[], uuid[], text[], text[], boolean, jsonb,
  timestamptz, uuid, integer, integer, text
) from public;
grant execute on function public.search_chat_messages(
  uuid, text, uuid[], uuid[], uuid[], text[], text[], boolean, jsonb,
  timestamptz, uuid, integer, integer, text
) to authenticated;
revoke execute on function public.count_chat_messages(
  uuid, text, uuid[], uuid[], uuid[], text[], text[], boolean, jsonb
) from public;
grant execute on function public.count_chat_messages(
  uuid, text, uuid[], uuid[], uuid[], text[], text[], boolean, jsonb
) to authenticated;
