# Staff Access Setup

## Dashboard prerequisites

In the company staging Supabase project:

1. Keep public signup disabled.
2. Set the staging/local Site URL as appropriate.
3. Allow the local callback `http://127.0.0.1:3010/auth/callback`, local `/auth/confirm` recovery routes, and the approved hosted callbacks.
4. Do not add a production callback until production is explicitly authorized.
5. Create the staff Auth user manually with a company-controlled email and a temporary password delivered outside this repository/chat.

An Auth user alone cannot enter the Campaign Desk.

The visible staff experience is branded **Vriksha Bandhan Campaign Desk**. This name change does not alter roles, profile requirements or authorization.

## Bootstrap the database profile

With ignored `.env.local` targeting staging and `SUPABASE_TARGET_ENVIRONMENT=staging`, dry-run first:

```bash
npm run staff:bootstrap -- --email=staff@example.com --display-name="Staff name" --role=admin
```

If the existing Auth user and intended role are correct, execute:

```bash
npm run staff:bootstrap -- --email=staff@example.com --display-name="Staff name" --role=admin --execute
```

Repeat with `--role=reviewer` for a Reviewer. Create at least one Admin and one Reviewer staging test account. The script refuses non-staging environments and never creates an Auth user or changes a password/token.

## Ongoing access

Admin manages display name, role and active state in `/admin/team`. Deactivate access instead of deleting history. The database prevents self-deactivation and removal of the final active Admin. Staff sign in at `/auth/login` and sign out from the Campaign Desk sidebar. Invalid credentials use generic copy, and internal redirect destinations are allowlisted to prevent open redirects.

Staff password recovery starts at `/auth/forgot-password`, uses a token-hash confirmation at `/auth/confirm`, and finishes at `/auth/set-password`. It does not disclose account or role state. Configure the hosted recovery template and redirect allowlist exactly as documented in [STAFF_PASSWORD_RECOVERY.md](STAFF_PASSWORD_RECOVERY.md); the default fragment-based Supabase recovery link is not compatible with the SSR flow.
