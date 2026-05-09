# Phase 21.4 — Airwallex trade-money sandbox plumbing

Status: implemented as sandbox-only scaffolding.

## Purpose

Phase 21.4 introduces provider-neutral trade-money mirroring for the existing Hellowhen ledger flow. It does not enable public money features, production pay-ins, production payouts, or normal-user wallet balances for the first beta.

The first beta remains:

- Need + Offer exchanges only.
- No normal-user wallet.
- No payouts.
- No money trades.
- No cash/off-platform money flow.
- `MONEY_PROVIDER=none` by default.

## What changed

### Provider interface

The money provider interface now includes sandbox trade-money hooks:

- `createTradeHold(input)`
- `releaseTradeHold(input)`
- `refundTradeHold(input)`

These mirror Hellowhen trade-money state into provider transaction records. The Hellowhen ledger remains the product source of truth.

### None provider

The `none` provider rejects trade-money actions. This keeps first-beta money-off behavior strict.

### Stripe provider

Stripe remains a disabled fallback/reference provider. Trade hold/release/refund methods are intentionally not implemented for Stripe in Phase 21.4.

### Airwallex provider

The Airwallex provider now supports sandbox-only trade-money mirroring:

- Trade hold records a provider transaction with no Airwallex API call.
- Trade release can create an Airwallex Connected Account Transfer from the platform wallet to the seller connected-account wallet.
- Refund before release records a local provider transaction only.
- Refund after release can create an Airwallex Charge to move funds from the seller connected-account wallet back to the platform wallet.

These API calls are gated behind sandbox/provider flags and are not enabled by default.

## Airwallex sandbox endpoints prepared

Airwallex sandbox trade release:

```txt
POST /api/v1/connected_account_transfers/create
```

Airwallex sandbox released-trade reversal/refund:

```txt
POST /api/v1/charges/create
```

The implementation follows Airwallex's documented connected-account funds-movement model:

- Connected Account Transfer: platform wallet to connected account wallet.
- Charge: connected account wallet to platform wallet.
- Funds movement status may start as `NEW` or `PENDING` and later become `SETTLED`, `FAILED`, or `SUSPENDED`.

## New provider transaction visibility

Admin can now inspect provider trade-money records at:

```txt
GET /admin/money/provider-transactions
```

The existing admin money page now loads:

- provider accounts
- provider wallet balances
- provider trade-money transactions
- provider events

## Runtime safety gates

Provider trade-money mirroring requires all of the following:

```txt
MONEY_FEATURES_VISIBLE=true
MONEY_LAUNCH_MODE=demo | private_beta | production
MONEY_PROVIDER=airwallex
MONEY_PROVIDER_SANDBOX_ONLY=true
MONEY_PROVIDER_TRADE_MONEY_ENABLED=true
AIRWALLEX_ENABLED=true
AIRWALLEX_ENV=demo
AIRWALLEX_BASE_URL=https://api-demo.airwallex.com
AIRWALLEX_CONNECTED_ACCOUNTS_ENABLED=true
```

Default `.env.example` remains money-off:

```txt
MONEY_PROVIDER=none
MONEY_PROVIDER_TRADE_MONEY_ENABLED=false
MONEY_FEATURES_VISIBLE=false
MONEY_TRADES_ENABLED=false
WALLET_VISIBLE=false
PAYOUTS_VISIBLE=false
```

## Product behavior

When provider trade-money mirroring is disabled, Hellowhen's existing internal ledger behavior continues and provider mirroring returns a skipped result. That keeps beta behavior safe and avoids breaking non-money flows.

When enabled in Airwallex sandbox:

1. Accepting a money-backed proposal mirrors the Hellowhen hold as a provider transaction record.
2. Completing a held-money trade mirrors release through an Airwallex sandbox Connected Account Transfer.
3. Canceling/refunding a held trade mirrors refund locally if no provider release happened.
4. Refunding after release can mirror the reversal through an Airwallex sandbox Charge.

## Not included

Phase 21.4 does not add:

- Airwallex pay-ins.
- Airwallex payouts.
- production Airwallex money movement.
- consumer-facing money trade UI.
- real user wallet top-ups.
- lifetime stored balances.
- business/brand KYB flows.

## Files touched

```txt
apps/api/src/modules/admin/admin.routes.ts
apps/api/src/modules/money/moneySafety.ts
apps/api/src/modules/money/tradeMoney.ts
apps/api/src/modules/money/providers/airwallexMoneyProvider.ts
apps/api/src/modules/money/providers/moneyProvider.types.ts
apps/api/src/modules/money/providers/noneMoneyProvider.ts
apps/api/src/modules/money/providers/stripeMoneyProvider.ts
apps/api/src/modules/trades/trades.routes.ts
apps/web/src/app/admin/money/page.tsx
packages/api-client/src/index.ts
packages/contracts/src/wallet.ts
docs/phase-21-4-airwallex-trade-money-sandbox.md
```

## Risks and notes

- This is sandbox-only plumbing. Do not turn on production trade-money movement from these flags.
- Hellowhen ledger records must remain the source of truth for product balances and trade state.
- Airwallex transfer/charge records can lag or fail, so admin reconciliation is required before any production launch.
- Refunds after a provider release are more complex than refunds before release because funds may already have moved to a connected-account wallet.
- Pay-ins and payouts are intentionally postponed to later phases.

## Next phase

Recommended next phase:

```txt
Phase 21.5 — Airwallex payouts sandbox
```

Before that, confirm whether to add Airwallex pay-in sandbox first or keep following the original roadmap with payouts sandbox next.
