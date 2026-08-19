# Email Delivery Pipeline

## Provider and kinds

Transactional delivery uses the configured Resend API or Gmail SMTP transport and the existing `email_deliveries` table:

- `submission_received` after successful finalisation, with no attachment or approval claim.
- `approval_certificate` only after Published state and a generated private certificate, with the PDF attached.
- `rejection` only after Admin final rejection. Reviewer recommendation never sends email.

Templates are lightweight responsive HTML with text fallbacks. Participant values are HTML-escaped. No participant photograph, tracking image, workflow jargon, staff identity, or internal moderation payload is included.

All three templates use the visible **Vriksha Bandhan** name and the revised gratitude-led campaign language. Content versions are `submission-received-v3`, `approval-certificate-v3` and `rejection-v3`. Receipt copy does not promise public display. Rejection email uses one approved reason code plus optional participant guidance; the separate internal moderation note is never emailed. Approval sends the certificate as a PDF attachment only.

## Immediate processing and durability

Public submission finalization, approval and final-rejection actions wait for their immediate email attempt after the authoritative transaction succeeds. This makes the normal path reach the provider before the response returns instead of depending on a later background callback. Database rows remain the durable truth: a failed or disabled immediate attempt never reverses the accepted submission or moderation result and stays visible in Deliveries for the bounded catch-up worker or an explicit Admin retry.

The service-only claim locks one eligible due `not_started` or `failed` row, checks the private suppression registry, assigns a claim token, increments attempts, and moves it to `queued`. Resend receives the stable database `idempotency_key`; Gmail SMTP receives a deterministic Message-ID derived from that key. A `sent` or `suppressed` row cannot be reclaimed automatically. Completion stores provider ID and template version, and reconciles any Resend webhook that arrived before completion. Retryable failures schedule 1 minute, 5 minutes, 30 minutes and 2 hours; attempt five is manual. Ambiguous work approaching the idempotency window becomes `manual_review`. An Admin's explicit new attempt increments the idempotency version and is audit logged.

Email failure never changes publication, rejection, count, certificate, Guardian number, or media.

## Provider webhook state

`sent` means Resend accepted the request, not inbox delivery. `POST /api/webhooks/resend` verifies the raw body with the Resend/Svix signature secret and stores only event ID, provider message ID, event type, safe bounce classification and timestamps. Duplicate and unsupported signed events return `200`; malformed/signature-invalid events return `400`; configuration or database failures return `503` so Resend retries. Permanent bounces, complaints and `email.suppressed` events add the normalized address to the private suppression registry. Transient bounces remain transport events and do not suppress future mail. Raw transport event rows are retained for 90 days.

## Environment safety

Set `EMAIL_PROVIDER=resend` with `RESEND_API_KEY`, or `EMAIL_PROVIDER=gmail_smtp` with `GMAIL_SMTP_USER` and `GMAIL_SMTP_APP_PASSWORD`. Both transports also require `EMAIL_FROM` and `EMAIL_REPLY_TO`. `EMAIL_SENDING_ENABLED=false` is the safe default. Enabling staging additionally requires `EMAIL_TEST_RECIPIENTS`, a comma-separated allowlist of at most five addresses. `EMAIL_TEST_RECIPIENT` remains a single-address fallback. Production refuses either override. The override happens only at send time and never changes the stored contact. Logs say only `staging recipient override active`.

The guarded smoke is dry-run by default:

```bash
npm run test:staging:certificate-email -- --certificate-only
npm run test:staging:certificate-email -- --certificate-only --execute
npm run test:staging:certificate-email -- --recipient=approved-test@example.com
npm run test:staging:certificate-email -- --execute --recipient=approved-test@example.com
```

Certificate-only mode needs no recipient and sends no email. It creates a synthetic non-counting Published fixture without consuming the real Guardian sequence, verifies generation, private upload/download, checksum/metadata and PDF opening, then verifies Storage/database cleanup and the baseline count.

Email mode additionally requires the argument to be present in the untracked staging allowlist. It sends one approval email and retries to prove no duplicate before performing the same cleanup checks.

## Supabase Cron owner

The database is the durable queue and Supabase Cron is the single production scheduler. Keep the URL and bearer secret in Supabase Vault; do not put either value in a migration or repository file.

Run this manually in the target project's SQL editor after replacing both example values. Do this in staging first:

```sql
select vault.create_secret('https://staging.example.com', 'email_worker_base_url');
select vault.create_secret('replace-with-a-long-random-secret', 'email_worker_bearer');

select cron.schedule(
  'vriksha-email-worker-five-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_base_url')
      || '/api/internal/process-deliveries?batch=10',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_bearer'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
```

Store the same bearer value as `INTERNAL_CRON_SECRET` in the matching Vercel environment. Verify with:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname = 'vriksha-email-worker-five-minutes';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'vriksha-email-worker-five-minutes')
order by start_time desc limit 10;
```

The Delivery Center must show a recent successful worker run and no growing oldest-due timestamp. Schedule `select public.purge_email_webhook_events(90, 1000);` daily through a second Cron job after the worker is verified.

## Transport-only testing

No open or click tracking is used. In staging, test receipt, approval attachment and rejection through the real application with allowlisted addresses. Then use Resend's transport test addresses in a provider-only test harness for delivered, bounced, complained and suppressed events. Confirm the webhook is idempotent, permanent outcomes suppress future work, transient bounce does not, and the Delivery Center separates provider accepted from delivered.

## Company Resend setup before production

1. Create the Resend account/organization under company control.
2. Add a company-approved sending subdomain.
3. Add the exact SPF and DKIM records shown by Resend through the company DNS process.
4. Verify the domain.
5. Review DMARC only through the company-approved DNS process.
6. Create a sending-only API key and store it only in protected staging/production environment settings.
7. Obtain company approval for sender display name, From address, Reply-To address, receipt/approval/rejection content and retention policy.
8. Keep production `EMAIL_SENDING_ENABLED=false` until sender-domain, legal/content and controlled production smoke sign-off are recorded.

Do not guess DNS records, impersonate an unverified Mirchi domain, print the key, or configure production from this task.
