-- A generic one-click report does not establish that the GIF is offensive.
-- Keep the report useful for moderation without assigning a reason the user
-- did not choose.

alter table public.message_gif_reports
  alter column reason set default 'other';
