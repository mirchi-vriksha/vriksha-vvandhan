# SECURITY DEFINER audit

Audit date: 10 August 2026. Scope: the effective schema after migration `20260810071755_production_operations_hardening.sql`.

## Audit standard

Every definer function was checked for a fixed empty `search_path`, schema-qualified relations and calls, bounded and validated input, least-privilege EXECUTE grants, trusted actor derivation, and sensitive output. New functions inherit the migration-level default that revokes function execution from `public`, `anon`, and `authenticated`; every exception is granted explicitly. No function constructs dynamic SQL.

## Inventory and disposition

| Function group | Execute audience | Disposition | Reason |
|---|---|---|---|
| `private.is_active_staff`, `private.current_staff_role`, `private.is_admin`, `private.is_reviewer_or_admin` | authenticated, through private-schema usage | REVIEWED / INTENTIONAL | RLS helpers use `auth.uid()` and server-owned `staff_profiles`; no caller-supplied actor or sensitive row is returned. |
| `private.current_published_count` | internal only | REVIEWED / INTENTIONAL | Returns one aggregate from fully qualified publication state; browser execution is revoked. |
| `public.prepare_public_submission`, `public.finalize_public_submission_with_review_thumbnail` | service role only | REVIEWED / INTENTIONAL | The app validates origin, body size, Turnstile, abuse limits, signed capability, media metadata, and consent before calling. PII is returned only to the trusted server. The obsolete finalise overload remains revoked. |
| `public.reserve_guardian_number_for_publication` | service role only | REVIEWED / INTENTIONAL | `p_actor_id` is accepted only from the server orchestrator after a verified staff session. The browser cannot execute this function. Row locking and a unique Guardian index prevent duplicate publication. |
| `public.update_submission_review_fields`, `public.recommend_submission_rejection` | authenticated | REVIEWED / INTENTIONAL | Each derives the actor from `auth.uid()`, checks an active Reviewer role, validates bounded fields, locks the target state, and writes an audit event. |
| `public.confirm_submission_rejection`, `public.trash_submission`, `public.restore_nonpublished_submission`, `public.restore_published_submission`, `public.delete_trashed_submission`, `public.manage_staff_profile`, `public.update_campaign_settings`, `public.record_campaign_data_export` | authenticated | REVIEWED / INTENTIONAL | Each derives `auth.uid()`, checks Admin server-owned role state, validates parameters and target state, and writes a bounded audit event. Broad table mutation remains denied. |
| `public.publish_submission` | authenticated | REVIEWED / INTENTIONAL | Active staff role is read from `staff_profiles`; rejection-pending publication is Admin-only. Metadata/path validation, row locking, unique Guardian enforcement and idempotent placeholders make the transition atomic. |
| `public.get_public_campaign_summary`, `public.list_public_movement_entries` | anon and authenticated | REVIEWED / INTENTIONAL | These are the only anonymous read RPCs. Output is purpose-specific: aggregate settings or approved public card metadata only. IDs, email, original paths, consent and audit data are omitted and page size is capped. |
| `public.claim_certificate_generation`, `public.complete_certificate_generation`, `public.fail_certificate_generation`, `public.claim_email_delivery`, `public.complete_email_delivery`, `public.fail_email_delivery` | service role only | REVIEWED / INTENTIONAL | Claim tokens, target-state checks, bounded attempts, safe error-code validation and exact object/provider metadata prevent client invocation and duplicate completion. Claim signatures were replaced to add controlled Admin recovery. |
| `public.list_due_certificate_work`, `public.list_due_email_work`, `public.recover_stale_delivery_claims` | service role only | FIXED | Added for bounded cron recovery. Limits are clamped, relations are qualified, stale claims remain failed/retryable, and no PII is returned. |
| `public.consume_application_rate_limit`, `public.purge_expired_rate_limits` | service role only | FIXED | Added for server-only abuse control. Only HMAC hashes are accepted/stored; syntax, limits, and windows are bounded. |
| `public.record_resend_webhook_event` | service role only | FIXED | Stores verified provider event metadata only, rejects invalid/future input, and is idempotent by event ID. It does not store the webhook body or recipient address. |

## Trigger functions

`private.set_updated_at` and `private.assert_completed_submission_consent` are trigger-only, not SECURITY DEFINER, and have no browser EXECUTE grant. They are not part of the definer inventory but were checked for qualified, static SQL.

## Verification

Local database reset, lint, generated-type drift, RLS tests, function-grant tests and pgTAP are required before release. Hosted Security Advisor must be rerun after the migration is applied to staging and again on the clean production project. Any new ERROR or exploitable warning is a launch blocker.
