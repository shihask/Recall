-- OPTIONAL — retry worker schedule. Not a migration on purpose: normal saves
-- process immediately (the browser calls process-saved-item right after
-- saving). This only adds a safety net that retries jobs whose immediate call
-- never arrived or failed, and backfills missing embeddings.
--
-- Prerequisites (one time):
--   1. supabase secrets set CRON_SECRET=<long random string, 32+ chars>
--   2. Deploy the worker:   supabase functions deploy process-pending --no-verify-jwt
--   3. Dashboard → Database → Extensions: enable pg_cron and pg_net.
--   4. Store the two values below in Vault (SQL editor), replacing placeholders:
--        select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/process-pending', 'recall_worker_url');
--        select vault.create_secret('<same CRON_SECRET value>', 'recall_cron_secret');
--   5. Run this file in the SQL editor.
--
-- The service-role key is never stored here: the worker authenticates the
-- schedule by CRON_SECRET and reads the service key from its own Edge secrets.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('recall-process-pending')
where exists (select 1 from cron.job where jobname = 'recall-process-pending');

select cron.schedule(
  'recall-process-pending',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'recall_worker_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recall_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
