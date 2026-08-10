# Production deployment runbook

This runbook is preparatory. Do not execute public deployment as part of Section 6.

1. Gate B real Resend delivery passes with the company-owned domain and approved recipient.
2. Legal/content approval is recorded in `LAUNCH_CONTENT_APPROVAL.md`.
3. GitHub, Supabase, Vercel, Resend and DNS company owners/recovery access are confirmed.
4. A clean production Supabase project is created in the approved region; no staging data is copied.
5. Reviewed migrations are dry-run and applied; database tests and Security/Performance Advisors pass.
6. All three bucket names, privacy, limits and MIME types are verified.
7. Only approved production staff Auth users and matching active profiles are created; Admin MFA/password policy is confirmed.
8. Production Turnstile keys/hostname are configured and server Siteverify is smoke-tested.
9. Production Resend key, approved sender/reply-to and Gate B configuration are entered with sending still disabled.
10. The signed Resend webhook is configured and valid/invalid/duplicate delivery events are verified.
11. Production-only Vercel variables, independent abuse/cron secrets and environment guards are entered.
12. A protected Preview is deployed and the full public/staff/mobile/accessibility flow is tested against the intended backend policy.
13. A production deployment is created with no public domain and `submissions_open=false`; run production-safe smoke checks.
14. Confirm `submissions_open` remains false and email remains disabled until final sign-off.
15. Attach the company-controlled custom domain.
16. Verify DNS, TLS/SSL, security headers, canonical/site URL, cookies, webhooks and cron routing.
17. Record final engineering, security, legal, operations, backup, ownership and Gate B sign-off.
18. Set `EMAIL_SENDING_ENABLED=true` only after Gate B/sign-off, then set `submissions_open=true` through the audited Admin control.
19. Monitor the first submissions, uploads, moderation, count, certificate, email/webhook and cleanup cycles; keep rollback owners online.

At any failure, stop and follow `ROLLBACK_RUNBOOK.md`. Never use production `db reset`, force-push, or copy the staging dataset.
