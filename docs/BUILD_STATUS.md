# Build Status

| Section | Scope | Status |
|---:|---|---|
| 1 | Premium public site and Promise Reel | Complete |
| 2 | Secure database, staff Auth and Storage foundation | Complete and staging-verified |
| 3 | Public submission, private upload and confirmation | Complete; CI, migration, linked types, Advisors and real hosted-staging smoke verified |
| 4 | Staff portal, moderation, publication, Movement Wall and live count | Complete; CI, staging migration, linked types, smoke and Advisors verified |
| 5 | Certificates, transactional email, Delivery Center and Admin XLSX export | CI, migration, linked types, certificate smoke, authenticated staging export and Advisors verified; email gate pending |
| 6 | Retention, load, security and launch hardening | Engineering hardening implemented; CI/staging validation and manual gates remain; production and public launch not performed |

Section 5 adds the approved-master PDF renderer, private versioned certificate Storage, Resend processor, permanent database idempotency, Admin Delivery Center, private downloads, manual retry/regeneration, and audited seven-sheet export. Application/database CI is green; the staging migration, linked types, guarded certificate-only smoke, authenticated staging export, and live Advisors are verified. Email remains disabled by default. Completion is withheld until the explicit-recipient email and duplicate-retry smoke pass.

The final Section 3 gate passed on 10 August 2026. A synthetic public request exercised the local `/api/submissions/prepare` and `/api/submissions/finalize` boundaries against linked hosted staging, including signed private upload, server-side image verification, private review-thumbnail generation, Pending Review state and repeated prepare/finalise idempotency. Submission `74f87222-ca03-4c9a-a75c-e13364ef56ab` was then fully removed through Storage API and trusted database cleanup. The public count remained `0` before and after, the target remained `983`, the Movement Wall did not change, and the original closed-submission setting was restored.

The real Section 5 email gate was not attempted on 10 August 2026 because `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_TEST_RECIPIENT`, and `EMAIL_SENDING_ENABLED` were absent. This is the expected fail-closed state; Section 5 remains pending Gate B. Section 6 may complete engineering but may not authorize launch while Gate B remains blocked.

Section 6 adds server-verified Turnstile, HMAC database-backed abuse limits, bounded secret-authenticated draft/delivery jobs, scheduled retry state, signed idempotent Resend webhook metadata, provider-delivered/bounced visibility, guarded read/mutation load harnesses, full responsive viewport coverage and production/backup/operations/rollback documentation. Final verification evidence is recorded in `SECTION_6_REPORT.md`; production remains untouched.

Staging UI testing also has a guarded, dry-run-first 18-record synthetic dataset with Storage-backed private images and bounded cleanup. See [STAGING_DEMO_DATA.md](STAGING_DEMO_DATA.md); it cannot target production and does not create Published records, certificates or sent email.
