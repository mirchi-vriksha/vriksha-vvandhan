# Email Delivery Pipeline

## Provider and kinds

Transactional delivery uses the Resend Node SDK and the existing `email_deliveries` table:

- `submission_received` after successful finalisation, with no attachment or approval claim.
- `approval_certificate` only after Published state and a generated private certificate, with the PDF attached.
- `rejection` only after Admin final rejection. Reviewer recommendation never sends email.

Templates are lightweight responsive HTML with text fallbacks. Participant values are HTML-escaped. No participant photograph, tracking image, workflow jargon, staff identity, or internal moderation payload is included.

All three templates use the visible **Vriksha Bandhan** name and the revised gratitude-led campaign language. Content versions are `submission-received-v2`, `approval-certificate-v2` and `rejection-v2`; eligibility, idempotency and delivery state transitions are unchanged.

## Immediate processing and durability

Next.js `after()` schedules a best-effort attempt only after the authoritative transaction succeeds. Database rows remain the durable truth. Section 6 adds a secret-authenticated bounded catch-up endpoint that recovers stale claims and processes due work; Admin retains explicit retries.

The service-only claim locks one eligible due `not_started` or `failed` row, assigns a claim token, increments attempts, and moves it to `queued`. Resend receives the existing stable database `idempotency_key`. A `sent` row can never be reclaimed, so database idempotency outlives the provider window. Completion stores provider ID and template version. Retryable failures schedule 1 minute, 5 minutes, 30 minutes and 2 hours; attempt five is manual. Only stable safe codes are retained.

Email failure never changes publication, rejection, count, certificate, Guardian number, or media.

## Provider webhook state

`sent` means Resend accepted the request, not inbox delivery. `POST /api/webhooks/resend` verifies the raw body with the Resend/Svix signature secret and stores only event ID, provider message ID, event type and timestamps. Duplicate IDs return success without duplicate processing. Delivery Center/export distinguish accepted, delivered, bounced, complained, delayed and provider-failed states. Unsigned, malformed and oversized payloads are rejected; recipient and full payload are not stored.

## Environment safety

Required server-only names are `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_REPLY_TO`. `EMAIL_SENDING_ENABLED=false` is the safe default. Enabling staging also requires `EMAIL_TEST_RECIPIENT`; override happens only at send time and never changes the stored contact. Logs say only `staging recipient override active`.

The guarded smoke is dry-run by default:

```bash
npm run test:staging:certificate-email -- --certificate-only
npm run test:staging:certificate-email -- --certificate-only --execute
npm run test:staging:certificate-email -- --recipient=approved-test@example.com
npm run test:staging:certificate-email -- --execute --recipient=approved-test@example.com
```

Certificate-only mode needs no recipient and sends no email. It creates a synthetic non-counting Published fixture without consuming the real Guardian sequence, verifies generation, private upload/download, checksum/metadata and PDF opening, then verifies Storage/database cleanup and the baseline count.

Email mode additionally requires the argument to match the untracked `EMAIL_TEST_RECIPIENT`. It sends one approval email and retries to prove no duplicate before performing the same cleanup checks.

## Company Resend setup before production

1. Create the Resend account/organization under company control.
2. Add a company-approved sending subdomain.
3. Add the exact SPF and DKIM records shown by Resend through the company DNS process.
4. Verify the domain.
5. Review DMARC only through the company-approved DNS process.
6. Create a sending-only API key and store it only in `.env.local` or protected Vercel environment.

Do not guess DNS records, impersonate an unverified Mirchi domain, print the key, or configure production from this task.
