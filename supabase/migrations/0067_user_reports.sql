-- A person-to-person report sink: the companion "tell someone" action to
-- blocking, so user-to-user chat has both (store review expects it). No
-- moderation workflow yet -- coaches/admins read this table directly until
-- volume proves more is needed. The reported person is never notified,
-- mirroring block_user's privacy contract.

-- reporter_id is nullable and survives the reporter's own account deletion
-- (set null, not cascade): the row exists to document the target, and a
-- report about a problem account should not evaporate just because whoever
-- filed it later left.
create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint user_reports_distinct_members check (reporter_id <> target_id)
);

create index user_reports_target_idx on public.user_reports (target_id);
-- Backs report_user's own rate-limit check below.
create index user_reports_reporter_created_idx
  on public.user_reports (reporter_id, created_at desc);

alter table public.user_reports enable row level security;

-- No policies and no `authenticated` grants: a report is write-only from the
-- reporter's side (never read back to them) and read only by moderation, so
-- both directions go through service_role / the security-definer function
-- below -- the same shape as conversation_mutes.
grant select, insert, update, delete on public.user_reports to service_role;

create or replace function public.report_user(p_target_id uuid)
returns boolean
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_client_caller();
begin
  if p_target_id is null or p_target_id = v_user_id then
    raise exception 'person unavailable';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'person unavailable';
  end if;

  -- Locks only the caller's own row (report_user never touches shared
  -- relationship state, so there is no pair to lock). This is what makes the
  -- count-then-insert below race-free: concurrent calls from the same
  -- reporter serialize on this row instead of all reading the same count.
  perform 1 from public.profiles where id = v_user_id for update;

  -- Same shape as send_friend_request's rate limit: caps abuse of the RPC
  -- itself without deduping legitimate repeat reports of the same person.
  if (
    select count(*)
    from public.user_reports
    where reporter_id = v_user_id
      and created_at >= now() - interval '5 minutes'
  ) >= 10 then
    raise exception 'report rate limited';
  end if;

  insert into public.user_reports (reporter_id, target_id)
  values (v_user_id, p_target_id);

  return true;
end;
$$;

revoke execute on function public.report_user(uuid) from public;
grant execute on function public.report_user(uuid) to authenticated;
