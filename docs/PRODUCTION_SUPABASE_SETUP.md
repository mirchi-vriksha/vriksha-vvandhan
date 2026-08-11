# Production Supabase setup

Do not reuse staging and do not copy staging data. A company owner must create a clean project in the company Supabase organisation. Prefer Mumbai / South Asia for this India-focused campaign unless company legal, residency or infrastructure policy chooses another region.

## Before creation

- Confirm two company owners, billing owner, recovery contact and approved region.
- Generate a new database password in company secret storage. Never paste it into Git, chat, screenshots or docs.
- Keep staging linked until a planned production setup window; record both project refs out of band.
- Gate B, legal approval and ownership sign-off must be complete before public launch.

## Safe migration procedure

```bash
git switch main
git pull --ff-only
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npx supabase link --project-ref <PRODUCTION_PROJECT_REF>
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase migration list --linked
```

Run the dry run first and have a second operator confirm the project ref. Never use `db reset` on production. Restore the staging link after the window if local operations still use it.

## Auth settings

- Disable public and anonymous signup; staff users are invite/admin-created only.
- Minimum password length: at least 8; require a strong mix supported by company policy.
- Enable leaked-password protection (Pwned Passwords).
- Require confirmed email, use company-managed staff addresses, and recommend/require MFA for Admins where operationally possible.
- Create only approved staff Auth users, then matching active `staff_profiles`; roles live only in `staff_profiles`, never user metadata.
- Verify generic login errors, logout, inactive-user denial and non-staff denial.

## Storage buckets

Create/verify through the Supabase Storage configuration UI with no broad public write policy:

| Bucket | Public | Limit | MIME types |
|---|---:|---:|---|
| `submission-originals` | no | 15 MiB | JPEG, PNG, WebP, HEIC, HEIF |
| `published-images` | yes | 5 MiB | JPEG, PNG, WebP |
| `certificates` | no | 10 MiB | PDF, PNG |

Review thumbnails share the private originals bucket. Only immutable approved card/full variants belong in `published-images`. Verify an anonymous direct read of an original/certificate fails and an approved public card succeeds.

## Clean production seed

Migrations create schema/settings only. Production receives no Demo Aarya/Kabir, `STAGING TEST`, `example.com` participant, smoke user, temporary staff, test certificate or test Storage object. Add approved staff profiles and the approved campaign settings only. Keep `submissions_open=false` through deployment and smoke testing.

## Verification

Run Security and Performance Advisors, inspect every warning, run production-safe read-only smoke checks, verify RLS/function grants/bucket visibility, and record a logical backup plus Storage manifest before opening submissions. Production credentials must never be used by Preview.
