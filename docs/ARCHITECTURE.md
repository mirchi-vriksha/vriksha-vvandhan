# Architecture

## Current structure

- `src/app` — App Router layout, homepage, global CSS, metadata image and 404 experience.
- `src/components/home` — focused components for each homepage section, including the server-rendered hero and Promise Ribbon plus the isolated Section 1.2 Promise Reel client boundary.
- `src/components/layout` — header, focus-managed mobile navigation, footer and mobile join bar.
- `src/components/shared` — campaign image wrapper, brand lockup, section heading and SVG Promise Tracker.
- `src/content/campaign.ts` — single source of truth for public campaign copy, seed metrics, navigation, images and mock/seed stories.
- `src/types/campaign.ts` — campaign-domain TypeScript types.
- `public/brand` and `public/campaign` — supplied brand assets and documented web derivatives.
- `e2e` — browser, navigation, overflow, console and axe checks.
- `supabase` — local configuration, three ordered migrations, empty seed and pgTAP database tests.
- `src/lib/env` — lazy public/server environment validation so the static site builds without credentials.
- `src/lib/supabase` — separate browser, request-scoped server, trusted service and scoped Proxy helpers.
- `src/lib/auth` — server-only staff DAL, typed errors and pure Reviewer/Admin permissions.
- `src/lib/storage` — fixed bucket names, immutable path validation and unexposed signed URL helpers.
- `src/components/submission` — the isolated public form, photo controls, status, retry, availability and success states.
- `src/lib/submissions` — shared validation, in-memory request capability, browser image preparation, origin checks, stable errors, private upload orchestration and trusted server verification.
- `src/app/admin`, `src/components/admin`, and `src/lib/moderation` — dynamic invite-only Campaign Desk, role-aware queues, private signed review, focal-point editing, and server-only publication orchestration.
- `src/lib/public-campaign`, `src/app/movement`, and `src/components/movement` — cached anonymous-safe campaign summary, keyset Movement data, public wall, and accessible full-image dialog.
- `src/lib/certificates`, `src/lib/email`, and `src/lib/deliveries` — server-only PDF/Storage, transactional delivery claims/templates/provider integration, and Admin operational reads.
- `src/lib/export` and `src/app/api/admin/export` — bounded server-side seven-sheet workbook generation behind Admin authorization.
- `src/lib/security` — server-only Turnstile Siteverify and HMAC-keyed database rate limiting; no raw client address or Turnstile token is persisted.
- `src/lib/internal`, `src/lib/operations`, and `src/app/api/internal` — constant-time secret authorization plus bounded, idempotent draft cleanup and delivery catch-up jobs.
- `src/app/api/webhooks/resend` — raw-body signed webhook verification and idempotent provider-state recording without storing recipient or payload.

## Staff and public publication boundary

Internal routes pass through the Next.js 16 Proxy for session refresh, but authorization is re-verified in the Data Access Layer and every mutation RPC. The service client is a separately marked server-only boundary because it downloads private originals, writes trusted variants, and bypasses RLS. Public visitors receive only two anonymous-safe RPC projections; no base campaign table or private original is exposed.

## Section 3 submission boundary

The homepage remains a Server Component tree. `/join` performs one server-side availability read and renders either a small Client Component form or a fail-closed state. Only the active form holds participant details, consent, the raw request token, and prepared image; none is persisted in browser storage.

The prepare and finalise Route Handlers run explicitly on Node.js. They enforce same-origin JSON requests, strict Zod contracts, stable public errors, server-authoritative Turnstile, bounded HMAC abuse limits and server-only service access. The browser uploads directly with a scoped signed token, but only server-verified bytes can enter Pending Review through the atomic finalisation RPC.

## Operations and delivery recovery

Immediate email/certificate processing remains best effort after the authoritative moderation transaction. Database rows are durable work records. A scheduled internal worker recovers stale claims, lists bounded due jobs and invokes atomic claim/complete/fail RPCs. Retry scheduling is stored in the database; attempt five needs explicit Admin investigation. A separate bounded cleanup job removes expired Draft objects through Storage before conditionally deleting only Draft rows. Both jobs fail closed without a strong server secret.

Resend `sent` means provider acceptance. Signed webhooks add independent delivered, bounced, complained, delayed and provider-failed timestamps. The event ID is the idempotency key; raw payloads and addresses are not retained.

## Visual-system boundary

The light campaign system is implemented as semantic CSS custom properties in `src/app/globals.css`. Components consume role-based tokens for the page canvas, white and soft surfaces, ink, Rakhi-red action, forest support, gold detail, dividers and shadows. This keeps visual changes independent from content records and component behaviour. `docs/LIGHT_VISUAL_SYSTEM.md` records the palette, surface rhythm, accessibility intent and exclusions.

## Content-driven design

Campaign wording and typed data live in `src/content/campaign.ts`, rather than being scattered through JSX. Components decide composition and semantics; content decides labels, copy, metrics and selected assets. This keeps later campaign approvals and translations localised.

The tracker receives `current`, `target` and `label` as typed data, calculates a rounded percentage and renders an accessible SVG medallion. `heroPromiseImages` is a typed collection of editorial campaign images that drives the progressively enhanced Promise Reel without presenting those images as approved public submissions. The Movement Wall uses explicit `seedMovementStories`; neutral labels prevent seed content from looking like genuine participant data.

## Server and Client Components

All homepage sections—including the Living Promise Hero and `PromiseRibbon` wrapper—remain Server Components. `MobileNavigation` handles menu focus and scroll locking, while the small `PromiseReel` Client Component handles only playback, reduced motion and temporary interaction pauses. Both boundaries receive serializable props and no campaign content is fetched client-side.

## Remaining integration points

- The homepage tracker now uses the cached public summary and falls back to an unavailable state.
- The homepage uses approved records only when at least six exist; otherwise curated imagery remains explicitly labelled.
- Activate the approved Resend sender/domain and environment values through company-controlled configuration.
- Add approved Ped Ka Paigaam audio sources and transcripts to the existing preview model.
- Replace the temporary campaign text lockup with the approved wordmark asset.

## Cache and rendering

Homepage and Movement summary/list fetches use 30-second server caching tagged `campaign-public`. Publication, Trash, restore, permanent deletion, and settings changes invalidate the tag. `/admin` is always dynamic, noindex, and never opens public Realtime connections.
