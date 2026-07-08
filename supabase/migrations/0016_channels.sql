-- Channels: a thin naming layer over conversations. This milestone seeds ONE
-- channel ("general") bound to the existing demo-community conversation, so no
-- membership/assignment tables and no message migration are introduced. Growing
-- to N channels later means adding rows + a membership table, not reworking this.

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.channels enable row level security;

grant select on public.channels to authenticated;
grant select, insert, update, delete on public.channels to service_role;

-- Any authenticated user may read channels (the same audience that can read the
-- demo community room). Membership scoping arrives with real assignment later.
create policy "authenticated read channels"
  on public.channels
  for select
  to authenticated
  using ((select auth.uid()) is not null);

-- Ensure the fixed demo-community conversation row exists. Driven from profiles
-- so a fresh reset with zero profiles no-ops instead of violating the not-null
-- client_id/coach_id columns -- in that case the root seed script (scripts/seed.ts)
-- upserts this same row by id once demo profiles exist.
insert into public.conversations (id, client_id, coach_id)
select
  private.demo_community_conversation_id(),
  p.id,
  p.id
from (
  select id
  from public.profiles
  order by created_at
  limit 1
) p
where not exists (
  select 1
  from public.conversations
  where id = private.demo_community_conversation_id()
)
on conflict do nothing;

-- Seed the single "general" channel bound to the demo-community conversation.
-- Guarded on that conversation existing so a fresh reset (no profiles, so no
-- conversation above) skips quietly instead of failing the foreign key.
insert into public.channels (id, slug, name, conversation_id)
select
  '22222222-2222-4222-8222-222222222222'::uuid,
  'general',
  'general',
  private.demo_community_conversation_id()
where exists (
  select 1
  from public.conversations
  where id = private.demo_community_conversation_id()
)
on conflict (slug) do nothing;
