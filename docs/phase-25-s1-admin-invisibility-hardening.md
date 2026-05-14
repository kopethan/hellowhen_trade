# Phase 25.S1 — Admin invisibility and hardening

## Goal

Keep the launch admin area out of normal user discovery and make sure admin access depends on backend authorization, not visible links or client-side hiding.

## Implemented

- Added an admin-only web layout gate for `/admin` routes.
  - Non-admin and signed-out visitors see a generic 404-style page.
  - Admin users still use the existing internal admin pages.
- Removed standalone admin login panels and default credential fields from web admin pages.
  - Admin tools now use the normal signed-in app session token.
  - Legacy `hellowhen:admin_access_token` storage is cleared when admin pages read the current session.
- Added no-index controls for admin web routes.
  - Admin pages export noindex metadata.
  - Next headers add `X-Robots-Tag: noindex, nofollow, noarchive` and `Referrer-Policy: no-referrer` for `/admin/*`.
  - `robots.ts` disallows `/admin`.
- Hardened admin API responses.
  - `/admin/*` API responses are `Cache-Control: no-store`.
  - `/admin/*` API responses include `X-Robots-Tag: noindex, nofollow, noarchive`.
  - Non-admin authenticated users receive a generic `404 not_found` from admin API routes instead of an explicit admin-required response.
  - Admin two-step enforcement remains explicit only after the account is confirmed to be an admin.
- Added web authenticator-code completion for accounts that require two-step login.
- Reduced seed/admin credential exposure.
  - `.env.example` no longer uses the local demo password as the example admin password.
  - Production seeding fails if the admin password falls back to the demo password.
  - Seed logs no longer print the admin password.

## Launch operator checklist

Before public beta:

1. Remove or rotate any local `admin@hellowhen.app` seed admin.
2. Set a unique `SEED_ADMIN_EMAIL` and strong `SEED_ADMIN_PASSWORD` outside local development.
3. Keep `ADMIN_REQUIRE_TWO_FACTOR=true`.
4. Log in through the normal app auth flow with the admin account and complete the authenticator-code challenge before opening `/admin`.
5. Enable authenticator app two-step verification for every admin account.
6. Confirm `/admin` is not linked from normal account, support, footer, sitemap, or app navigation.
7. Confirm non-admin users see a generic not-found screen for `/admin`.
8. Confirm `/api/admin/*` requires an admin token and returns generic `not_found` for non-admin users.

## Non-goals

- No route renaming or secret admin path in this phase.
- No IP allowlist in this phase.
- No new admin role hierarchy.
- No moderation behavior changes.
- No money/wallet/payout/provider enablement.
