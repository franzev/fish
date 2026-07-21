-- Server-generated, privacy-safe link metadata. Recipients never fetch the
-- original URL from their device and image previews are intentionally omitted.
create table if not exists public.message_link_previews (
  message_id uuid primary key references public.messages(id) on delete cascade,
  url text not null,
  hostname text not null,
  title text,
  description text,
  site_name text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_link_preview_jobs (
  message_id uuid primary key references public.messages(id) on delete cascade,
  url text not null,
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'complete', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_link_preview_jobs_ready_idx
  on public.chat_link_preview_jobs (next_attempt_at)
  where state = 'pending';

alter table public.message_link_previews enable row level security;
alter table public.chat_link_preview_jobs enable row level security;

revoke all on public.message_link_previews from public, anon, authenticated;
revoke all on public.chat_link_preview_jobs from public, anon, authenticated;
grant select on public.message_link_previews to authenticated;
grant all on public.message_link_previews to service_role;
grant all on public.chat_link_preview_jobs to service_role;

drop policy if exists "members read message link previews" on public.message_link_previews;
create policy "members read message link previews"
  on public.message_link_previews
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages message
      where message.id = message_link_previews.message_id
        and private.is_conversation_member(message.conversation_id)
    )
  );

alter publication supabase_realtime add table public.message_link_previews;
