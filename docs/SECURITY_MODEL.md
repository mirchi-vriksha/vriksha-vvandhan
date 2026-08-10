# Security Model

## Boundaries

- Anonymous visitors have no direct table writes. Section 3 mutations pass through same-origin, server-validated Route Handlers and service-role-only RPCs.
- Staff identity is verified by Supabase Auth. Portal access additionally requires an active `staff_profiles` row.
- Reviewer/Admin roles are read from the database, not request fields or editable user metadata.
- Row Level Security provides the database read boundary; no broad direct mutation policy is granted even to Admin.
- The server-only Data Access Layer verifies claims again, loads the active profile and returns only a minimal `StaffSession` DTO.
- Next.js Proxy only refreshes `/admin` and `/auth` sessions and performs an optimistic verified-identity check. It never queries roles and is not the final authorization boundary.

## Secrets and private data

The publishable key may reach the browser. `SUPABASE_SECRET_KEY` is validated lazily inside server-only code, bypasses RLS and must never be logged or returned. Participant email is readable only to Admin. Original photographs stay in the private `submission-originals` bucket and are viewed using short-lived signed URLs. The public bucket is only for trusted approved derivatives.

`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `ABUSE_HASH_SECRET` and cron secrets are server-only. Provider requests, recipient addresses, attachment bytes, signed URLs, Turnstile tokens, raw client addresses, and raw provider errors are never logged or stored. Staging sends fail closed without an explicit test-recipient override; production rejects an override. Certificate downloads require Admin again and redirect to a fresh two-minute private signed URL.

Prepare calls perform authoritative Cloudflare Siteverify before creating a Draft. Production fails closed if Turnstile or the HMAC abuse secret is absent. Fixed-window limits store only a server-keyed SHA-256 HMAC, scope, count and expiry. Finalise uses the hashed request capability as the abuse key; Admin export uses the verified staff UUID.

## Security-definer helpers

Private RLS helpers use an empty fixed `search_path`, schema-qualified references and minimum execute grants. Default table/function exposure is revoked. Section 4 grants only the anonymous-safe public summary/list functions and purpose-specific authenticated staff functions; each staff function re-checks active role and workflow state inside the transaction.

The two Section 3 public-schema RPCs are also security-definer with empty search paths, fully qualified objects, explicit validation, transaction-local advisory locking, and execute granted only to `service_role`. The browser capability is cryptographically random; only its SHA-256 hash reaches the database. Public errors never include raw database/Storage messages, participant values, secrets, or request tokens.

Signed upload creation fixes the UUID-based private path and disables overwrite. No anonymous Storage policy is added. Finalisation trusts neither filename, declared MIME, size, dimensions, nor checksum from the browser: the Node.js server downloads and inspects the stored bytes with bounded Sharp settings.

Section 5 claim/complete/fail RPCs are executable only by `service_role` and re-check eligibility inside each transaction. The authenticated export-audit RPC re-checks active Admin in the database. Reviewer cannot access Delivery Center, certificate downloads, retry/regeneration, or campaign export. XLSX generation neutralizes formula/control-prefix attacks and excludes request hashes, secrets, signed URLs, binaries, and sensitive audit JSON.

## Advisor review

The last pre-Section-6 staging Advisor run had zero Security errors; the exact warning baseline and the new operational migration must be rerun and recorded before completion. Every effective SECURITY DEFINER function is inventoried in `SECURITY_DEFINER_AUDIT.md`. Advisor warnings are never waived solely because they are warnings: the fixed search path, grants, actor source, parameters and output are reviewed individually. Production Advisor results are a launch gate. See the [Supabase Database Linter guidance](https://supabase.com/docs/guides/database/database-linter).

Global response headers add CSP, clickjacking denial, no-sniff, strict referrer policy, constrained browser capabilities and production HSTS. CSP permits only the configured Supabase origin and Cloudflare Turnstile resources required by the application.

## Permanent deletion order

Hard deletion verifies Admin, requires the record already be in Trash, a reason, and literal `DELETE` confirmation in the UI. Server orchestration removes original, public variants and any certificate through the Storage API and stops if cleanup fails, then invokes the database delete transaction with a non-sensitive audit event. Storage objects are never deleted with raw SQL.
