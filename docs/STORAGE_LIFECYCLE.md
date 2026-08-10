# Storage Lifecycle

## Buckets

- `submission-originals`: private, 15 MiB, JPEG/PNG/WebP/HEIC/HEIF.
- `published-images`: public read, trusted server write, 5 MiB, WebP/JPEG/PNG.
- `certificates`: private, trusted server write, 10 MiB, PDF/PNG.

Buckets are declared in `supabase/config.toml` and created with the current bucket-seeding command. The Storage schema is not altered by application SQL.

## Paths

- Original: `<submission-uuid>/original.<allowlisted-extension>`
- Private review thumbnail: `<submission-uuid>/review-thumb.webp`
- Public card: `card/<guardian-number>-<immutable-version>.webp`
- Public full: `full/<guardian-number>-<immutable-version>.webp`
- Certificate: `<submission-uuid>/vriksha-guardian-<guardian-number>-<immutable-version>.pdf`

Paths contain no names, emails, locations, free-form input or original filenames. Public paths are immutable/versioned and never overwritten.

## Lifecycle

Section 3 requests a non-overwriting signed upload for the generated private path, then downloads and verifies the stored bytes before Pending Review. The Section 6 cleanup endpoint processes at most 100 expired Drafts, lists/removes each matching private object through Storage, then conditionally deletes only a still-expired Draft row. A 15-minute production schedule with batch 50 is recommended. Invalid prepared objects are also removed with their Draft, while transient verification failures preserve both for retry.

Section 4 finalisation reuses verified original bytes to generate a private, metadata-free 240×300 WebP review thumbnail. The queue signs these derivatives in one authenticated batch and never requests originals. Authorized review URLs use a ten-minute TTL; the detail page displays the review thumbnail first and requests the full private original only for that submission. Publication downloads the private original server-side, auto-rotates it, strips metadata, creates a 640×800 WebP card and an at-most-1600×1600 WebP full image, uploads immutable versioned paths, then commits their dimensions/bytes atomically with Published state. Partial uploads are removed on failure.

Trash immediately hides the row and removes public variants through the Storage API while retaining the original and review thumbnail for recovery. Published restore generates a new immutable version before restoring public visibility.

Section 5 generates the versioned private PDF only after publication. It uploads without overwrite, downloads the object to verify size/SHA-256, and only then marks it Generated. Admin download signs it for two minutes on demand. Approval email reads the private bytes as an attachment; no public certificate URL is required. Explicit regeneration removes only the confirmed current-version object immediately before replacement upload. Permanent deletion and bounded demo cleanup remove the original, review thumbnail, public variants and certificate through the API before deleting the record.

Database backups do not contain Storage bytes. Production backup must export all bucket paths separately, preserve paths and write a resumable checksum/size manifest as described in `BACKUP_AND_RECOVERY.md`. Development must not bulk-download hosted participant media.
