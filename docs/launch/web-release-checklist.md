# Web Release Checklist

> Documentation note: this checklist is operational readiness guidance, not legal advice.

## Before public web release

- Confirm `.env` keeps `NEXT_PUBLIC_MONEY_FEATURES_VISIBLE=false`, `NEXT_PUBLIC_WALLET_VISIBLE=false`, `NEXT_PUBLIC_PAYOUTS_VISIBLE=false`, and `NEXT_PUBLIC_MONEY_TRADES_ENABLED=false`.
- Run web typecheck/build.
- Verify `/trades`, `/needs`, `/offers`, `/account`, `/auth`, `/legal`, `/account/support`, and `/admin` load in light and dark mode.
- Verify French and English labels on auth, account, settings, support, report, and legal pages.
- Verify auth registration links to Terms and Privacy.
- Verify public optional-auth reads work with signed-out, signed-in, and revoked/stale-token states.
- Verify restricted/hidden content is absent from discovery and public profile routes.
- Verify report buttons and support tickets still work after adding policy links.
- Verify no old demo/wallet copy appears when money UI flags are off.
- Verify metadata, favicon, app name, and production URLs are set for the launch domain.
