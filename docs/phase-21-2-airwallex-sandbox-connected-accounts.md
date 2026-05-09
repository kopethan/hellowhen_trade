# Phase 21.2 — Airwallex sandbox connected accounts

Phase 21.2 turns the Phase 21.1 provider abstraction into a sandbox-only Airwallex connected-account scaffold.

## Safety default

The first beta remains money-off:

```env
MONEY_PROVIDER=none
MONEY_LAUNCH_MODE=disabled
MONEY_FEATURES_VISIBLE=false
WALLET_VISIBLE=false
PAYOUTS_VISIBLE=false
MONEY_TRADES_ENABLED=false
CASH_TRADES_ENABLED=false
```

Airwallex code is present but cannot move production money. The adapter blocks production access when `MONEY_PROVIDER_SANDBOX_ONLY=true`.

## Added backend behavior

### Airwallex API helper

`apps/api/src/modules/money/providers/airwallexClient.ts`

- Authenticates with `POST /api/v1/authentication/login`.
- Reuses the access token until near expiry.
- Uses `AIRWALLEX_BASE_URL`, defaulting to `https://api-demo.airwallex.com`.
- Blocks production while sandbox-only mode is enabled.
- Verifies Airwallex webhook signatures with `x-timestamp` + raw JSON payload + HMAC SHA-256.

### Airwallex provider adapter

`apps/api/src/modules/money/providers/airwallexMoneyProvider.ts`

Supports sandbox-only:

- `getConnectedAccount(userId)`
- `createConnectedAccount({ userId })`
- `createOnboardingLink({ userId, returnUrl, refreshUrl })`
- `syncConnectedAccountStatus({ userId | providerAccountId })`

Still blocked intentionally:

- pay-ins
- wallet balance sync
- trade money holds/releases
- platform-fee money movement
- payouts
- refunds/disputes

Those remain future phases.

### Airwallex webhook route

`apps/api/src/modules/money/providers/airwallexWebhook.routes.ts`

Mounted at:

```txt
POST /airwallex/webhook
```

The route:

- requires `MONEY_PROVIDER_WEBHOOKS_ENABLED=true`
- requires `AIRWALLEX_ENABLED=true`
- verifies the Airwallex signature when a webhook secret is configured
- stores events in `MoneyProviderEvent`
- best-effort syncs matching connected accounts
- keeps Stripe webhook routing untouched

### Provider-neutral wallet routes

Existing routes continue:

```txt
GET  /wallet/provider-account
POST /wallet/provider-account/onboarding-link
POST /wallet/provider-account/sync
```

The onboarding-link route now accepts optional URLs:

```json
{
  "returnUrl": "https://example.com/account/payouts?airwallex=return",
  "refreshUrl": "https://example.com/account/payouts?airwallex=error"
}
```

## Env flags added

```env
AIRWALLEX_HOSTED_FLOW_TEMPLATE_ID=
AIRWALLEX_ONBOARDING_RETURN_PATH=/account/payouts?airwallex=return
AIRWALLEX_ONBOARDING_ERROR_PATH=/account/payouts?airwallex=error
```

For local sandbox testing only, use something like:

```env
MONEY_PROVIDER=airwallex
MONEY_LAUNCH_MODE=demo
MONEY_FEATURES_VISIBLE=true
PAYOUTS_VISIBLE=true
MONEY_PROVIDER_ACCOUNT_CREATION_ENABLED=true
MONEY_PROVIDER_WEBHOOKS_ENABLED=true
AIRWALLEX_ENABLED=true
AIRWALLEX_ENV=demo
AIRWALLEX_BASE_URL=https://api-demo.airwallex.com
AIRWALLEX_CONNECTED_ACCOUNTS_ENABLED=true
AIRWALLEX_CLIENT_ID=...
AIRWALLEX_API_KEY=...
AIRWALLEX_HOSTED_FLOW_TEMPLATE_ID=...
AIRWALLEX_WEBHOOK_SECRET=...
```

Do not use production credentials in Phase 21.2.

## Database additions

The new migration adds provider-neutral tables that were introduced in schema scaffolding:

- `MoneyProviderAccount`
- `MoneyProviderWalletBalance`
- `MoneyProviderTransaction`
- `MoneyProviderEvent`

It also adds provider-neutral payout reference fields to `PayoutRequest`.

## Admin visibility

Backend admin routes now combine provider-neutral Airwallex records with legacy Stripe records:

```txt
GET /admin/money/provider-accounts
GET /admin/money/provider-events
```

A simple web admin page was added:

```txt
/admin/money
```

It shows:

- active provider status
- connected accounts
- provider events
- legacy Stripe records as compatibility records

## What this phase does not do

Phase 21.2 does **not** enable:

- normal-user wallet balances
- Airwallex pay-ins
- Airwallex wallet balance sync
- money trades
- platform-fee movement
- payouts
- refunds
- production onboarding

## Next phase

Phase 21.3 should add Airwallex sandbox wallet-balance sync and ledger reconciliation. It should still keep first-beta money features hidden by default.
