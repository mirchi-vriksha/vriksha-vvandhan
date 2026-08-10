# Backup and recovery

## Ownership and objectives

The company infrastructure owner owns database backups; the campaign operations owner owns Storage exports and restore drills. The company must approve retention, RPO and RTO before launch. Recommended starting targets are a 24-hour database RPO, four-hour service RTO, daily Storage manifest/export, and a quarterly restore drill; these are proposals, not approved policy.

## Database

Supabase plan-level backups/PITR must be confirmed in the production project. In addition, create an encrypted logical dump from a trusted company workstation or runner:

```bash
supabase db dump --linked --file <ENCRYPTED_BACKUP_PATH>/schema.sql
supabase db dump --linked --data-only --use-copy --file <ENCRYPTED_BACKUP_PATH>/data.sql
```

Never commit dumps. Store encrypted copies in company-controlled storage with access logs and retention. A restore drill uses a new isolated recovery project: apply schema/migrations, restore data, validate constraints/RLS/counts and run read-only smoke tests. Never overwrite production for a drill.

## Storage

Database backups do not restore Storage object bytes. Export these separately: private originals (including review thumbnails), public published variants, and private certificates. The backup job should page/list one bucket prefix at a time, download through the Storage API with a service credential, preserve the exact object path, and append a manifest containing bucket, path, byte length, content type, ETag/checksum when available and backup timestamp. It must checkpoint each page so reruns resume safely.

Do not bulk-download hosted participant media during development. Run the production exporter only after company approval on a locked-down runner. Encrypt private buckets at rest and in transit; keep public and private manifests separate. Verify a sample checksum and perform a controlled restore to a non-production bucket/project.

## Recovery order

1. Stop writes with `submissions_open=false`; disable delivery cron if necessary.
2. Preserve logs/current data and identify the incident boundary.
3. Recover database into an isolated project and validate before cutover.
4. Restore Storage paths from the matching manifest; never make private buckets public.
5. Reconcile DB object metadata, Guardian uniqueness, public count and delivery idempotency.
6. Rotate exposed credentials, run Security Advisor and smoke tests, then obtain two-person sign-off.

Record each backup and drill without participant email, signed URLs, tokens or file contents in logs.
