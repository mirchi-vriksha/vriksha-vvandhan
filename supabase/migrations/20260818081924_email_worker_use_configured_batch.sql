-- Let the worker enforce EMAIL_BATCH_SIZE instead of hard-coding a larger
-- query-string override in the durable staging scheduler.
select cron.unschedule('vriksha-email-worker-five-minutes')
where exists (
  select 1
  from cron.job
  where jobname = 'vriksha-email-worker-five-minutes'
);

select cron.schedule(
  'vriksha-email-worker-five-minutes',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret || '/api/internal/process-deliveries'
        from vault.decrypted_secrets
        where name = 'email_worker_base_url'
        order by created_at desc limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'email_worker_bearer'
          order by created_at desc limit 1
        ),
        'x-vercel-protection-bypass', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'vercel_automation_bypass'
          order by created_at desc limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);
