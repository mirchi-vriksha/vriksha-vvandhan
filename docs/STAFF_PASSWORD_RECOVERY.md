# Staff Password Recovery

## Architecture

Password recovery is staff-only UI, but it never reveals whether an address belongs to an Admin, Reviewer, inactive profile, Auth-only user, or no user. Public signup remains disabled, and normal Campaign Desk authorization still requires an active `staff_profiles` row through `requireStaff()`.

The secure SSR flow is:

1. `/auth/forgot-password` calls `resetPasswordForEmail` with the application-owned `/auth/confirm` redirect derived from `NEXT_PUBLIC_SITE_URL`.
2. The recovery email links directly to `/auth/confirm` with a one-time `token_hash`, `type=recovery`, and the allowlisted `/auth/set-password` destination.
3. `/auth/confirm` accepts only recovery tokens, calls `verifyOtp`, writes the Supabase SSR session through response cookies, and adds a short-lived HttpOnly recovery marker.
4. `/auth/set-password` requires both the marker and a server-verified Supabase user before calling `updateUser({ password })`.
5. A successful update signs out only the local recovery session and redirects to `/auth/login?password-reset=1`. Other devices are not explicitly signed out by application code.

The application never consumes implicit `access_token` or `refresh_token` URL fragments. It does not log, display, persist, or document recovery tokens or passwords.

## Hosted Supabase configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://vriksha-vvandhan.vercel.app`
- Redirect URLs: retain required local development entries and add `https://vriksha-vvandhan.vercel.app/auth/confirm`.

In Authentication → Email Templates → Reset password, use a project-owned link with this structure:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/auth/set-password">
  Set a new password
</a>
```

Do not use the default `{{ .ConfirmationURL }}` for this SSR flow: it verifies at the Auth endpoint and returns the session in a browser fragment that the server cannot consume. Keep provider link tracking disabled so the one-time URL is not rewritten. The repository config includes the equivalent local template at `supabase/templates/recovery.html`.

## Vercel configuration

Set `NEXT_PUBLIC_SITE_URL=https://vriksha-vvandhan.vercel.app` for the hosted environment. Keep the existing hosted Supabase URL and publishable key. Never expose the Supabase secret key or any recovery token through a `NEXT_PUBLIC_` variable.

## Exposed-session response

The previously exposed implicit recovery URL is compromised and must never be reused. Revoke or sign out the affected staging sessions where supported, discard all old recovery messages, and request a fresh link only after the token-hash template is active. A password change should be followed by normal sign-in verification.

## Staging smoke procedure

Use only a staging staff account:

1. Revoke/sign out the affected old session.
2. Request a fresh reset from `/auth/forgot-password`.
3. Open only the latest email once and confirm the browser reaches `/auth/set-password` without an access/refresh-token fragment.
4. Set a new unique password of at least 8 characters.
5. Confirm redirect to `/auth/login?password-reset=1` and that the recovery session is signed out locally.
6. Sign in normally, confirm the expected active staff profile, and verify the permitted Campaign Desk route.
7. Confirm expired, reused, and missing-token links return the generic recovery error.

Never paste the message, link, token hash, session token, or password into logs, tickets, chat, screenshots, or this repository.

## Production considerations

Before production use, repeat URL/template configuration in the separate production Supabase project, use company-controlled SMTP, confirm the password-change security notification, review Auth rate limits, run a production-preview smoke with a dedicated test staff account, and retain public signup as disabled.
