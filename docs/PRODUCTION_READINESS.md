# Production readiness scorecard

Status date: 11 August 2026. This scorecard separates engineering evidence from permission to launch. **The campaign is not launch-ready while Gate B, company ownership, legal approvals and final visual sign-off remain open.**

| Area | Status | Evidence / condition |
|---|---|---|
| Functional | PASS | Public, staff, delivery, export and recovery paths are implemented; unit/component and production-build checks pass. |
| Security | PASS | RLS and SECURITY DEFINER controls are documented and pgTAP-covered; Turnstile, HMAC rate limits, secret internal jobs, signed webhook verification and production security headers are implemented. Hosted Advisors must be rerun after the migration is applied. |
| Mobile | PASS | Automated Chromium coverage includes all required mobile, landscape, tablet and desktop viewports with page-overflow assertions. Physical iOS/Android review remains a manual deployment gate. |
| Accessibility | PASS | Automated serious/critical axe checks pass for public pages and Campaign Desk; keyboard, reduced motion, no-JavaScript reel and 200% layout checks are covered. Physical assistive-technology review remains manual. |
| Performance | WARNING | Production build is optimized and public bounded load completed without failures. Development-server p95 under 100-way concurrency was 6.3s homepage and 8.6s Movement; production-preview measurement is required. |
| Reliability | PASS | Bounded idempotent cleanup, delivery claims, stale-claim recovery, scheduled retry policy and duplicate-safe webhook ingestion are implemented. |
| Backup | PASS | Database/PITR, private Storage copy, restore drill, retention and evidence requirements are specified in `BACKUP_AND_RECOVERY.md`. Activation is a production setup step. |
| Operations | PASS | Cron authorization, monitoring thresholds, retry handling, incident response, cleanup and rollback are documented. |
| Ownership | BLOCKED | Company-controlled GitHub/Supabase/Vercel/Resend/Turnstile owners and a second recovery owner require written confirmation. |
| Legal | BLOCKED | Terms, privacy, consent text, retention, campaign dates and participant support contact require company/legal approval. |
| Email | BLOCKED | Gate B real Resend domain, sender and explicit-recipient delivery verification has not passed. Email remains fail-closed. |
| Deployment | BLOCKED | No production project or public deployment was created. Gate B, ownership/legal signoff, production provisioning and preview smoke are required first. |
| Public brand/content | LOCAL PASS | Official public name is Vriksha Bandhan; concise Home/Join/Movement content, metadata, certificates, email, export and staff branding are implemented. Hosted and company visual sign-off remain required. |

## Decision

The codebase is prepared for the controlled deployment sequence in `PRODUCTION_DEPLOYMENT_RUNBOOK.md`. It is **not ready to launch**. `submissions_open` must remain false until every BLOCKED item is cleared and production smoke/signoff is recorded.
