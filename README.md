# Vriksha Bandhan

Vriksha Bandhan is Mirchi's Raksha Bandhan campaign inviting people to make a promise of protection to a tree. The repository contains the concise public campaign site, secure Supabase foundation, private submission flow, invite-only Campaign Desk, personalized certificates, and approved public Movement Wall.

The official public campaign name is **Vriksha Bandhan**. The GitHub repository, package name, hosted URL, Supabase project, and other deployed identifiers retain the historical `vriksha-vvandhan` slug to avoid infrastructure churn.

## Six-section roadmap

1. **Premium public experience** — responsive campaign homepage, tracker UI and progressively enhanced Promise Reel. Complete; Section 4 now supplies the tracker’s live count.
2. **Backend foundation** — Supabase schema, RLS, staff roles, Storage rules, server clients, authorization DAL, tests and CI. Complete and verified on staging.
3. **Public submission flow** — display name, email, one privately uploaded photograph, publication consent, terms acceptance, server verification and Pending Review confirmation. Complete and hosted-staging verified; the credentialed smoke evidence is recorded in `docs/SECTION_3_REPORT.md`.
4. **Internal operations and publication** — staff portal, moderation workflow, Guardian assignment, public Movement Wall and live derived count. Complete and staging-verified.
5. **Certificates, delivery operations and export** — personalized private PDFs, transactional email, Admin retries/downloads, and sensitive audited XLSX export. Implemented; final staging/CI gates are tracked in `docs/SECTION_5_REPORT.md`.
6. **Hardening and launch preparation** — Turnstile, abuse controls, scheduled recovery, signed delivery webhooks, responsive/load verification, backups and release runbooks. Engineering complete; public launch remains blocked by Gate B and company sign-offs.

The homepage still builds without Supabase credentials and shows an honest unavailable count rather than fabricated campaign data. Email remains disabled by default even when the rest of the application is configured.

## Local application setup

Requirements: Node.js 22.22.2, 24.15.0, or a later supported even-numbered release, plus npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Supabase values may remain empty when working only on the public homepage. Backend modules validate them lazily when called.

## Local backend setup

Docker Desktop or another Docker-compatible runtime is required by the Supabase CLI.

```bash
npm run db:start
npm run db:reset
npm run db:buckets:seed
npm run db:lint
npm run db:test
npm run db:types
npm run db:types:check
npm run db:stop
```

See [BACKEND_SETUP.md](docs/BACKEND_SETUP.md) for environment, staff provisioning and hosted-project guidance.

## Application commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:load:public -- --base-url=http://127.0.0.1:3010
npm run test:load:staging-workflows -- --execute
npm run cleanup:drafts:dry-run
npm run test:staging:submission
npm run staff:bootstrap -- --email=staff@example.com --display-name="Staff name" --role=reviewer
npm run test:staging:moderation -- --execute
npm run certificate:preview -- /private/tmp/certificate.pdf "Test Name"
npm run test:export
npm run test:staging:certificate-email -- --recipient=approved-test@example.com
```

## Environment variables

```dotenv
NEXT_PUBLIC_SITE_URL=
GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_TARGET_ENVIRONMENT=
EMAIL_PROVIDER=resend
RESEND_API_KEY=
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
EMAIL_FROM=
EMAIL_REPLY_TO=
EMAIL_SENDING_ENABLED=
EMAIL_TEST_RECIPIENT=
EMAIL_DAILY_LIMIT=350
EMAIL_BATCH_SIZE=5
EMAIL_TIMEZONE=Asia/Kolkata
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_ENABLED=false
ABUSE_HASH_SECRET=
INTERNAL_CRON_SECRET=
CRON_SECRET=
RESEND_WEBHOOK_SECRET=
```

Only `NEXT_PUBLIC_*` values are browser-visible. Supabase/provider/Turnstile/cron/abuse secrets remain server-only. `EMAIL_PROVIDER` may be `resend` or `gmail_smtp`; Gmail SMTP additionally requires its mailbox and 16-character App Password. Staging sends require `EMAIL_SENDING_ENABLED=true` and an explicit `EMAIL_TEST_RECIPIENT`; production rejects that override and stored contacts are never rewritten. The database reserves the configured daily capacity atomically and defers overflow until the next calendar day in `EMAIL_TIMEZONE`.

The public SEO canonical is `https://mirchivrikshabandhan.online`. Set `NEXT_PUBLIC_SITE_URL` to the same value in production so authentication links and public canonical URLs stay aligned. Google Search Console Domain properties should be verified with Google's exact DNS TXT record. If the URL-prefix HTML-tag method is used instead, set `GOOGLE_SITE_VERIFICATION` to the tag's `content` value before verification. After deployment, submit `https://mirchivrikshabandhan.online/sitemap.xml`.

Guarded staging scripts additionally require `SUPABASE_TARGET_ENVIRONMENT=staging` in the untracked local environment. Never configure this marker for production.

## Current limitations

- Docker is required to apply and execute the local migrations, bucket seed and pgTAP suites.
- Staff Auth users are provisioned manually; public participants never receive accounts.
- Legal consent text, retention, approved production sender domain/DNS, geography, campaign dates, media rights, final standalone wordmark and post-983 behaviour remain unresolved.
- Gate B real Resend verification, company ownership, production environment creation, real-device/browser QA and legal/content approvals remain explicit launch blockers.

The hosted staging project has been linked and its Section 2 migrations, RLS,
policies and Storage bucket restrictions have been verified. No hosted
credential is committed; production remains untouched.

See [production readiness](docs/PRODUCTION_READINESS.md), [deployment runbook](docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md), [operations](docs/OPERATIONS_RUNBOOK.md), [certificate pipeline](docs/CERTIFICATE_PIPELINE.md), [email delivery pipeline](docs/EMAIL_DELIVERY_PIPELINE.md), and [Section 6 report](docs/SECTION_6_REPORT.md).
