# Section 6 report

## Outcome

Section 6 adds the production hardening and operational architecture without creating production infrastructure, publishing a deployment, enabling participant email, or changing Gate B. The starting commit was `4565e2ce8e3c57179b3a3ca8c6b94053500bebd1` on `main` in `mirchi-vriksha/vriksha-vvandhan`.

## Audit and fixes

- **BLOCKER retained:** Gate B is incomplete because company Resend credentials/domain are unavailable. Public launch and participant email remain blocked.
- **BLOCKER retained:** legal/content approval and multi-owner company handover need written signoff.
- **HIGH fixed:** public prepare now requires authoritative server-side Turnstile verification when enabled and fails closed in production if misconfigured.
- **HIGH fixed:** prepare, finalize and Admin export receive database-backed bounded limits using server-HMAC abuse keys; raw IP addresses are not retained.
- **HIGH fixed:** cleanup and delivery recovery are secret-authenticated, bounded, idempotent jobs with stale-claim recovery and no PII logging.
- **HIGH fixed:** Resend events use raw-body signature verification, bounded payloads, provider event IDs and duplicate-safe persistence; recipient addresses and full payloads are not stored in webhook events.
- **HIGH fixed:** delivery retries are classified, scheduled and bounded; exhausted attempts require an explicit audited Admin action.
- **MEDIUM fixed:** Campaign Desk gained an explicit Trash route and mobile containment through 320px.
- **MEDIUM fixed:** CSP, HSTS-in-production, referrer, MIME, frame, permissions and opener headers are configured. Development-only `unsafe-eval` is excluded from production.

## Database and authorization

Migration `20260810071755_production_operations_hardening.sql` adds private abuse buckets, delivery scheduling/event metadata, atomic claim/recovery functions and webhook event idempotency. Every new application table enables RLS. Browser roles do not receive direct private-table access. Service-role functions revoke PUBLIC/anon/authenticated execution unless intentionally staff-scoped; actor identity remains `auth.uid()` for staff mutations. The function-by-function result is in `SECURITY_DEFINER_AUDIT.md`.

Local pgTAP passed 275 assertions after the migration before the final added duplicate-concurrency assertions. A final local rerun was interrupted by macOS/iCloud offloading the ignored `supabase/.temp` CLI state; therefore CI must provide the definitive fresh pgTAP count before deployment. This is not represented as a pass that did not occur.

## Application verification

Evidence captured on 10 August 2026:

- `npm audit`: 0 vulnerabilities.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm test`: 40 files, 160 tests passed.
- `npm run build`: pass; 15 static pages generated and all dynamic routes compiled.
- Local HTTP: `/`, `/join`, `/movement`, `/auth/login` returned 200; `/admin` correctly redirected unauthenticated access.
- Bounded read-only load: 100/100 homepage and 100/100 Movement requests returned 200 with zero failures. Development-server p95 was 6303ms and 8632ms respectively; production-preview performance remains a warning.
- Playwright: 53/53 passed in the final aggregate run, including all 35 functional/accessibility checks and the 18-case viewport matrix after fixing the only discovered 320px Trash overflow.
- Axe: no serious/critical findings on homepage, join, Movement Wall and Campaign Desk in automated Chromium checks.
- Real-device Safari/Chrome, screen-reader and production-preview performance tests were not performed and are documented manual gates.

## Operational architecture

- `POST|GET /api/internal/cleanup-expired-drafts`: secret-authenticated, bounded Storage-first cleanup; never touches Pending Review or later states.
- `POST|GET /api/internal/process-deliveries`: recovers stale claims and drains bounded certificate/email work.
- `POST /api/webhooks/resend`: signed, raw-body, 64KB-bounded, duplicate-safe provider outcome ingestion.
- Automatic delivery retry intervals: about 1m, 5m, 30m and 2h, then manual review.
- Production and staging remain separate by required target assertions and environment variables. No staging rows, private objects, staff accounts or secrets are to be copied to production.

## Artifacts

Created: `PRODUCTION_READINESS.md`, `PRODUCTION_DEPLOYMENT_RUNBOOK.md`, `PRODUCTION_SUPABASE_SETUP.md`, `VERCEL_PRODUCTION_SETUP.md`, `BACKUP_AND_RECOVERY.md`, `ROLLBACK_RUNBOOK.md`, `SECURITY_DEFINER_AUDIT.md`, `LAUNCH_CONTENT_APPROVAL.md`, `OPERATIONS_RUNBOOK.md`, and this report. Updated: README, BUILD_STATUS, ARCHITECTURE, SECURITY_MODEL, STORAGE_LIFECYCLE and EMAIL_DELIVERY_PIPELINE.

## Release decision

Engineering hardening is implemented and ready for CI/staging validation. It is **not publicly deployed and not ready to launch**. Gate B, legal/content approval, company ownership confirmation, hosted migration/advisors, real-device review, production provisioning, preview smoke and final signoff remain mandatory.
