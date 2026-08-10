# Operations runbook

## Routine jobs

- Every 15 minutes: call the secret-authenticated expired-draft job, batch 50. It removes private objects through Storage first, deletes only still-expired Draft rows and purges old abuse buckets.
- Every 5 minutes: call the secret-authenticated delivery catch-up job, batch 10. It recovers claims older than 15 minutes, then claims bounded due certificate/email work.
- Daily: inspect delivery failures/backlog, draft backlog, Storage cleanup failures, Turnstile rejection rate, submission 4xx/5xx rate, Vercel function errors, Supabase capacity and Resend events.
- Weekly: verify backup completion/manifests and review Admin export audit events.

Use `Authorization: Bearer <INTERNAL_CRON_SECRET or CRON_SECRET>`. An absent/weak secret fails closed. Duplicate invocations are safe because DB claims and webhook event IDs are atomic.

## Retry semantics

Automatic retryable delivery failures schedule approximately 1 minute, 5 minutes, 30 minutes and 2 hours. Attempt five requires Admin investigation. Timeouts, 429, provider 5xx/temporary errors retry; invalid sender/recipient, unverified domain and missing configuration do not retry endlessly. Admin retry is explicit and audited through existing staff access. Provider `sent` means accepted by Resend; `delivered`, `bounced`, `complained`, `delivery delayed` and `provider failed` are separate signed webhook states.

## Alert thresholds (initial proposals)

- Certificate or email failure: any permanent failure, or 5 failures/15 minutes.
- Delivery backlog: oldest eligible item older than 15 minutes, or more than 25 due.
- Expired Draft backlog: more than 100 after two cleanup runs.
- Storage cleanup: any removal/list failure.
- Submission/API: 5xx above 1% for five minutes; sustained 429/Turnstile failures require abuse-vs-outage review.
- Capacity: alert at company-selected Supabase database/Storage and Vercel usage thresholds before hard limits.

These checks may use Vercel logs, Supabase logs/advisors and Resend dashboard/webhooks. Add external error tracking only after approval.

## Logging rules

Allowed: request ID, workflow transition, safe error code, duration, bounded submission UUID when operationally necessary, provider message ID. Never log participant email, signed URL, raw/request token, Auth/service/cron/Turnstile/Resend secret, certificate bytes or webhook payload. Redact exports and treat downloaded XLSX files as PII: Admin-only, company-controlled storage, no personal email/WhatsApp or unapproved cloud sync, delete local copies after use.

## Incident triage

Close submissions for a write-path integrity issue, preserve data, disable only the implicated worker, use the rollback runbook, rotate exposed secrets, and record an incident owner/timeline. Do not reset production or roll moderation state back because notification delivery failed.
