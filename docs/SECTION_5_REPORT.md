# Section 5 Report

## Scope and baseline

Section 5 started from company `main` commit `bfec2dec506282cd7a6a5ed59278e527d559dffe`. The linked hosted project remains staging. No production resource is in scope and Section 6 was not started.

## Implemented

- Approved-master A4 PDF renderer, embedded OFL Marcellus, long-name fallback, India approval date, Guardian helper, checksum, versioned private path, verified upload, retry/regeneration, and Admin signed download.
- Resend receipt, approval-with-PDF, and rejection templates/processor; database claims, stable idempotency, safe errors, staging override, disabled default, post-transaction attempts, and manual retries.
- Admin-only Delivery Center, status cards/filters/actions, submission-detail status, overview metrics, and audited seven-sheet XLSX export with formula protection.
- One Section 5 migration, pgTAP, unit/component/API/Playwright coverage, guarded staging smoke, and documentation.

## Dependencies

- `pdf-lib` 1.17.1 and `@pdf-lib/fontkit` 1.1.1.
- `resend` 6.18.1.
- `exceljs` 4.4.0 with `uuid` 11.1.1 override.
- `tsx` 4.23.10 as a development-only verification runner.

## Local evidence

- Real normal-name and long Unicode two-line PDFs were generated, parsed with `pdfinfo`, rendered through Poppler, and visually inspected against the supplied personalized reference.
- A real 1,000-row XLSX was saved, parsed, inspected through the spreadsheet runtime, and rendered for visual review.
- Lint, typecheck, 141 unit/component tests, production build, 31 Playwright tests, dependency audit, and the 236-assertion database suite passed.
- GitHub Actions run `31169693245` is green. The Section 5 migration is applied only to linked staging, linked generated types match the committed snapshot, and the guarded certificate-only staging smoke verified generation, private upload/download, checksum/metadata, PDF opening, cleanup, and restoration of the public baseline.
- The authenticated local Admin route connected to staging returned `200` for `/api/admin/export/campaign.xlsx`. The downloaded workbook opened with the seven expected sheets and zero formula cells; its successful export audit event was part of the same transaction path. The sensitive verification download was moved to Trash after inspection.
- Live staging Advisors report Security 0 errors / 16 warnings / 0 info, and Performance 0 errors / 0 warnings / 7 unused-index suggestions. The warnings remain recorded for explicit hardening rather than being silently treated as clean.

## Completion gates

Section 5 remains **in progress** until a real explicit-recipient staging email and duplicate retry pass. Company-controlled Resend configuration is not present locally, so email remains safely disabled. Advisor warnings also remain visible for a later, separately reviewed hardening change. No email success or Section 5 completion is claimed before the required gates.

The pre-Section-6 email gate was rechecked on 10 August 2026. `SUPABASE_TARGET_ENVIRONMENT=staging` and the linked hosted-staging project were confirmed, but `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_TEST_RECIPIENT`, and `EMAIL_SENDING_ENABLED` were absent. In accordance with the fail-closed delivery policy, no provider call, recipient lookup, certificate email, rejection email, failure/retry test or duplicate-send test was attempted. Sender-domain verification is therefore also unverified. Gate B remains blocked on company-controlled staging email configuration; Section 5 is not complete and Section 6 has not started.
