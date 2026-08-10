# Vriksha Vvandhan

Vriksha Vvandhan is Mirchi's Raksha Bandhan campaign inviting people to protect a tree. The repository contains the premium campaign site, secure Supabase foundation, private submission flow, invite-only Campaign Desk, and approved public Movement Wall.

## Six-section roadmap

1. **Premium public experience** — responsive campaign homepage, tracker UI and progressively enhanced Promise Reel. Complete; Section 4 now supplies the tracker’s live count.
2. **Backend foundation** — Supabase schema, RLS, staff roles, Storage rules, server clients, authorization DAL, tests and CI. Complete and verified on staging.
3. **Public submission flow** — display name, email, one privately uploaded photograph, publication consent, terms acceptance, server verification and Pending Review confirmation. Complete and hosted-staging verified; the credentialed smoke evidence is recorded in `docs/SECTION_3_REPORT.md`.
4. **Internal operations and publication** — staff portal, moderation workflow, Guardian assignment, public Movement Wall and live derived count. Complete and staging-verified.
5. **Certificates, delivery operations and export** — personalized private PDFs, transactional email, Admin retries/downloads, and sensitive audited XLSX export. Implemented; final staging/CI gates are tracked in `docs/SECTION_5_REPORT.md`.
6. **Hardening and launch** — retention, load, accessibility, security and operational launch checks.

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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_TARGET_ENVIRONMENT=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_REPLY_TO=
EMAIL_SENDING_ENABLED=
EMAIL_TEST_RECIPIENT=
```

Only the publishable key is browser-safe. `SUPABASE_SECRET_KEY` and `RESEND_API_KEY` must remain in server-only environments. Staging sends additionally require `EMAIL_SENDING_ENABLED=true` and an explicit `EMAIL_TEST_RECIPIENT`; stored contacts are never rewritten.

Guarded staging scripts additionally require `SUPABASE_TARGET_ENVIRONMENT=staging` in the untracked local environment. Never configure this marker for production.

## Current limitations

- Docker is required to apply and execute the local migrations, bucket seed and pgTAP suites.
- Staff Auth users are provisioned manually; public participants never receive accounts.
- Legal consent text, retention, approved production sender domain/DNS, geography, campaign dates, media rights, final wordmark and post-983 behaviour remain unresolved.
- Local Docker-backed database execution remains unavailable until sufficient Mac disk space is available; GitHub Actions performs the same ephemeral database verification.

The hosted staging project has been linked and its Section 2 migrations, RLS,
policies and Storage bucket restrictions have been verified. No hosted
credential is committed; production remains untouched.

See [the certificate pipeline](docs/CERTIFICATE_PIPELINE.md), [email delivery pipeline](docs/EMAIL_DELIVERY_PIPELINE.md), [Admin export](docs/ADMIN_DATA_EXPORT.md), and [Section 5 report](docs/SECTION_5_REPORT.md).
