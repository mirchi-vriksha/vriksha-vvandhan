# Certificate Pipeline

## Approved master and rendering

The renderer uses the corrected PNG at `src/assets/certificate/vriksha-bandhan-certificate-master.png` as an immutable full-page background. Its SHA-256 is `c054f51258b0fc806e2a58f6f22c78bcfa89ab17cf0747dff4e9c606af3f7fdf`. The 1492×1054 master cleanly displays **Vriksha Bandhan** in the title, recognition line and footer, and uses the official public tagline. Its dimensions and campaign artwork are unchanged; final company design sign-off remains a launch gate.

`generate-certificate.server.ts` creates a 297×210 mm PDF with `pdf-lib`, embeds the approved artwork, and draws only:

- The trimmed `display_name`, centered over the designated line.
- The numeric Guardian number, padded to at least four digits for display.
- The `approved_at` date in `Asia/Kolkata`, such as `07 August 2026`.

Marcellus is embedded from the project-owned Google Fonts/OFL asset to match the approved reference. The reference explicitly establishes uppercase, tracked serif display for the name, a large Guardian number inside the medallion, a serif date, and the repeated footer number. Names scale from 42 pt down to 18 pt. If one line cannot fit, the renderer chooses a word boundary and uses two centered lines. A name that still cannot fit fails with `display_name_too_long`; it is never silently truncated. The same input and template version produce deterministic bytes in the verified runtime.

## Version and private Storage

The current version is `vriksha-bandhan-2026-v2`. Private objects use:

`<submission-id>/vriksha-guardian-<guardian-number>-v2.pdf`

Paths never contain names, emails, tokens, or staff identity. Uploads use `application/pdf`, `upsert: false`, and the private `certificates` bucket. The server downloads the uploaded object and verifies byte size and SHA-256 before completing database state. Admin download creates a new two-minute signed URL; URLs are neither persisted nor logged.

Previously issued v1 PDFs remain immutable in private Storage. A normal generation claim does not regenerate an already generated certificate; Admin regeneration remains an explicit, confirmed operation. New certificates use v2.

## Claim, retry, and failure isolation

The service-only claim/complete/fail functions use an unguessable claim token and row lock. Only an active, non-trashed Published submission with an assigned Guardian number and approval time is eligible. Claims increment `attempt_count` and move `not_started` or `failed` to `queued`.

Failure records only a bounded stable error code. It never changes submission status, Guardian number, public media, approval time, or count. Admin can retry. Regeneration requires literal `REGENERATE` confirmation; a generated certificate is otherwise idempotent. A future approved design must use a new version and immutable path.

## Verification

Use `npm run certificate:preview -- /private/tmp/preview.pdf "Test Name"`. Preview output must remain outside Git. Render through Poppler after layout changes and inspect normal, Unicode, and two-line names before changing the version.

The linked staging certificate-only smoke generated a non-counting synthetic Published fixture, stored and downloaded its private PDF, opened it with `pdf-lib`, matched checksum/byte/path metadata, removed the private object and fixture, and restored the public baseline count. It did not send email.
