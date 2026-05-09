# Phase 21.3 — Airwallex sandbox wallet balance sync

Phase 21.3 adds read-only provider wallet-balance sync scaffolding for Airwallex sandbox connected accounts.

This phase does **not** enable first-beta money features.

## Launch safety position

The first beta remains money-off:

- no wallet for normal users
- no payouts for normal users
- no money trades
- no cash/off-platform money flow
- service / goods / other Need+Offer exchanges only

Airwallex remains sandbox/demo-only until provider, legal, compliance, and country launch questions are answered.

## What this phase adds

### Provider interface

`MoneyProviderAdapter` now includes wallet-balance methods:

```ts
getWalletBalances(input)
syncWalletBalances(input)
```

These methods are provider-neutral, so later Stripe or another provider can expose balance snapshots without changing wallet routes.

### Airwallex sandbox balance sync

The Airwallex provider can now call:

```txt
GET /api/v1/balances/current
```

with:

```txt
x-on-behalf-of: <connected account id>
x-sca-token: <optional Airwallex SCA token>
```

The response is normalized into provider-agnostic balance rows:

```txt
currency
availableCents
reservedCents
pendingCents
totalCents
externalUpdatedAt
lastSyncedAt
```

Balances are stored in the existing Phase 21.2 model:

```txt
MoneyProviderWalletBalance
```

No database migration is needed in this phase because Phase 21.2 already introduced the balance table.

### API routes

User routes:

```txt
GET  /wallet/provider-balances
POST /wallet/provider-balances/sync
```

Admin routes:

```txt
GET  /admin/money/provider-balances
POST /admin/money/provider-accounts/:accountId/sync-balances
```

### Contracts/client

New shared schemas/types:

```txt
moneyProviderWalletBalanceSchema
moneyProviderWalletBalancesSyncRequestSchema
moneyProviderWalletBalancesResponseSchema
MoneyProviderWalletBalanceDto
MoneyProviderWalletBalancesSyncRequest
MoneyProviderWalletBalancesResponse
```

New API client methods:

```txt
wallet.providerBalances()
wallet.syncProviderBalances()
admin.moneyProviderBalances()
admin.syncMoneyProviderBalances()
```

### Admin UI

`/admin/money` now includes:

- provider accounts
- provider wallet balances
- provider events
- manual sandbox balance sync button per provider-neutral account

Legacy Stripe rows stay visible, but they are read-only in the provider-neutral balance sync table.

### User wallet UI

Web and mobile wallet screens can show provider balance snapshots when wallet features are intentionally enabled for sandbox testing. The first beta still hides those screens by default.

## Safety gates

Balance sync requires:

```txt
MONEY_PROVIDER=airwallex
MONEY_LAUNCH_MODE=demo or private_beta
MONEY_FEATURES_VISIBLE=true
WALLET_VISIBLE=true
MONEY_PROVIDER_WALLET_SYNC_ENABLED=true
AIRWALLEX_ENABLED=true
AIRWALLEX_CONNECTED_ACCOUNTS_ENABLED=true
AIRWALLEX_ENV=demo
AIRWALLEX_BASE_URL=https://api-demo.airwallex.com
```

Default `.env.example` remains safe:

```txt
MONEY_PROVIDER=none
MONEY_LAUNCH_MODE=disabled
MONEY_FEATURES_VISIBLE=false
WALLET_VISIBLE=false
MONEY_PROVIDER_WALLET_SYNC_ENABLED=false
```

So direct beta users cannot access wallet balance sync unless the developer intentionally enables sandbox flags.

## SCA note

Airwallex may require Strong Customer Authentication for recent balance and transaction data retrieval. Phase 21.3 accepts an optional `scaToken` in sync requests, but it does not implement the embedded SCA component yet. If Airwallex returns an SCA-required error, the API surfaces the provider error and the next phase should add a dedicated SCA client flow.

## Ledger rule

Hellowhen's own ledger remains the product source of truth.

Provider wallet balances are snapshots for reconciliation only. They should not be used as the sole source of user-facing product balances, trade settlement state, payout eligibility, or dispute decisions.

## What remains blocked

Phase 21.3 still blocks:

- Airwallex pay-ins
- trade money holds
- trade money releases
- platform fee movement
- payouts
- refunds
- production Airwallex access
- lifetime real user balances

Those remain for later sandbox phases.

## Next phase

Phase 21.4 should add Airwallex trade money sandbox modelling only after the team decides the exact sandbox pay-in and hold model.
