# Vercel production setup

Use a company-owned Vercel team with two authorised maintainers, company billing and Deployment Protection for Preview. Do not attach the public domain in this Section 6 work.

## Environment separation

| Variable | Preview | Production |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | protected Preview URL | final HTTPS campaign URL |
| `NEXT_PUBLIC_SUPABASE_URL` | staging | production only |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging | production only |
| `SUPABASE_SECRET_KEY` | staging | production only |
| `SUPABASE_TARGET_ENVIRONMENT` | `staging` | `production` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | staging/test widget | production widget |
| `TURNSTILE_SECRET_KEY` | staging/test secret | production secret |
| `TURNSTILE_ENABLED` | explicit policy; normally `true` for shared QA | `true` |
| `ABUSE_HASH_SECRET` | dedicated Preview secret | separate production secret, at least 32 random bytes |
| `RESEND_API_KEY` | staging key | company production key |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | staging-approved identity | approved company sender/reply-to |
| `EMAIL_SENDING_ENABLED` | `false`, except supervised Gate B | `false` until Gate B and launch sign-off |
| `EMAIL_TEST_RECIPIENT` | required when staging sending is enabled | absent; production rejects an override |
| `RESEND_WEBHOOK_SECRET` | staging endpoint secret | production endpoint secret |
| `INTERNAL_CRON_SECRET` or `CRON_SECRET` | Preview-specific if invoked | production random secret, at least 32 bytes |
| `PLAYWRIGHT_STAFF_ADAPTER` | absent | absent |

All unprefixed values are server-only. Preview must never receive production Supabase, Resend, Turnstile, cron or abuse secrets.

## Deployment protection and indexing

- Require Vercel Deployment Protection for Preview/internal QA.
- Public pages may be indexed only on the final production hostname after sign-off. Admin and login metadata remain `noindex`.
- Protection exceptions, if needed, should be narrowly scoped to `/api/webhooks/resend` and the two secret-authenticated internal job routes; do not expose the rest of Preview.

## Cron configuration at deployment time

Create production schedules only after `CRON_SECRET`/`INTERNAL_CRON_SECRET` is stored and routes are smoke-tested:

- `GET /api/internal/cleanup-expired-drafts?batch=50` every 15 minutes.
- `GET /api/internal/process-deliveries?batch=10` every 5 minutes.

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Do not put the secret in a query string. Start email sending disabled; the worker leaves email jobs pending.

## Release checks

Use a protected Preview first. Confirm security headers/CSP, HTTPS cookies, Turnstile, rate limiting, webhooks, internal-route 401/503 behaviour, mobile pages and a production-safe smoke while `submissions_open=false`. Attach the custom domain only after the full deployment runbook sign-off.
