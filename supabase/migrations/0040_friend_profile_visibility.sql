-- Direct chat hydration needs each participant's safe profile projection.
-- Keep the table policy limited to accepted, unblocked friendships.

create policy "friends read each other"
  on public.profiles
  for select
  to authenticated
  using (
    id <> (select auth.uid())
    and private.are_friends(id, (select auth.uid()))
    and not private.is_blocked_pair(id, (select auth.uid()))
  );
