-- Text size is no longer a stored profile preference. Browser and operating
-- system accessibility settings remain the source of truth for text scaling.
alter table public.client_profiles
  drop column text_size_pref;
