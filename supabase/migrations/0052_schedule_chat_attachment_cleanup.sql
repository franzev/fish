-- Keep the cleanup job visible on every environment immediately. It remains
-- dormant until configure_chat_attachment_cleanup stores the public project
-- URL and dedicated secret in Vault; no broad service-role credential is used.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-chat-attachments';

select cron.schedule(
  'cleanup-chat-attachments',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := project_url.decrypted_secret || '/functions/v1/chat-image-command',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cleanup-secret', cleanup_secret.decrypted_secret
      ),
      body := '{"action":"cleanup-expired"}'::jsonb,
      timeout_milliseconds := 30000
    )
    from vault.decrypted_secrets project_url
    cross join vault.decrypted_secrets cleanup_secret
    where project_url.name = 'chat_attachment_project_url'
      and cleanup_secret.name = 'chat_attachment_cleanup_secret';
  $job$
);
