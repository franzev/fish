-- Hardened profile-creation trigger (DB-01): a failing trigger would abort the entire
-- auth.users insert transaction, so this is prevention, not recovery. All four hardening
-- elements below are mandatory, not a subset (Pitfall 4):
--   security definer   -- runs with the function owner's grants against public.profiles
--   set search_path=''  -- prevents search-path hijacking, forces fully-qualified names
--   coalesce(...)       -- tolerates missing/null display_name metadata
--   on conflict do nothing -- idempotent re-run never fails on a duplicate id
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name, email)
  values (
    new.id,
    'client', -- AUTH-01/D-04/DB-04: signup ALWAYS creates a client, never trust metadata for role
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    new.email -- added in 0006_client_reads_coach_name.sql; kept here so a fresh db reset matches the live function
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
