-- Add the client's clock display preference. NULL keeps the browser/locale
-- default; explicit values force 12-hour or 24-hour rendering.
alter table public.client_profiles
  add column time_format_pref text check (time_format_pref in ('12h', '24h'));

grant update (time_format_pref) on public.client_profiles to authenticated;
