# Patch 7 — Stripe test-mode credit purchase simulation

Patch 7 adds Stripe test-mode credit purchase simulation while keeping Hellowhen fake/test-credit-first.

## Added

- Fixed credit packages from the API:
  - 50 credits
  - 100 credits
  - 250 credits
  - 500 credits
- `CreditPurchase` database model and `CreditPurchaseStatus` enum.
- Stripe Checkout Session creation for test-mode credit purchases.
- Stripe webhook endpoint for `checkout.session.completed`, `checkout.session.expired`, and `checkout.session.async_payment_failed`.
- Ledger-first fulfillment:
  - successful webhook updates `CreditPurchase` to `paid`
  - adds `credit_purchase` ledger entry
  - increments purchased available credits
- Mobile `BuyCreditsScreen` inside Account.
- Web return pages:
  - `/credits/success`
  - `/credits/cancel`
- Basic admin credit purchase review page:
  - `/admin/credits`
- Admin API purchase visibility:
  - `GET /admin/credits/purchases`

## Important safety boundaries

- Stripe is test-mode only.
- Purchased credits are non-withdrawable.
- No Stripe Connect.
- No payouts.
- No seller onboarding.
- No production money flow.
- If Stripe env vars are missing, checkout is disabled with a friendly error and the rest of the app keeps working.

## Local env

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=eur
WEB_APP_URL=http://localhost:3000
MOBILE_APP_URL=hellowhen://
```

## Useful local Stripe CLI test command

```bash
stripe listen --forward-to localhost:4000/stripe/webhook
```

Then copy the `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.
