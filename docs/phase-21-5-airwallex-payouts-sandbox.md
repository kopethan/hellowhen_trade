# Phase 21.5 — Airwallex payouts sandbox

## Goal

Add sandbox-only payout plumbing for the future Airwallex money launch while keeping the first beta money-off.

This phase does **not** enable production payouts, normal-user payouts, pay-ins, open wallet balances, or public money trades. It extends the provider architecture so admins can test payout request approval, provider transfer creation, provider status sync, and failed-transfer visibility in a sandbox/demo configuration.

## Default safety state

The default environment remains safe for the first beta:

```env
MONEY_PROVIDER=none
MONEY_LAUNCH_MODE=disabled
MONEY_FEATURES_VISIBLE=false
WALLET_VISIBLE=false
PAYOUTS_VISIBLE=false
MONEY_TRADES_ENABLED=false
MONEY_PROVIDER_PAYOUTS_ENABLED=false
```

With those defaults:

- normal users cannot see wallet or payout UI
- backend payout routes stay blocked by money-safety gates
- Airwallex adapter methods cannot create transfers
- Stripe remains present only as a disabled fallback/reference

## New sandbox payout configuration

Phase 21.5 adds Airwallex payout sandbox settings:

```env
AIRWALLEX_SANDBOX_PAYOUT_BENEFICIARY_ID=
AIRWALLEX_SANDBOX_PAYOUT_TRANSFER_METHOD=LOCAL
AIRWALLEX_SANDBOX_PAYOUT_REASON=services
```

`AIRWALLEX_SANDBOX_PAYOUT_BENEFICIARY_ID` is required because Hellowhen does not yet collect beneficiary/bank-account details from users. The adapter refuses to create an Airwallex sandbox payout transfer without this value.

## Backend changes

### Provider interface

The provider abstraction now supports payout transfer creation and status sync:

```ts
createPayoutTransfer(input: CreatePayoutTransferInput): Promise<ProviderTransferResult>;
syncPayoutTransfer(input: SyncPayoutTransferInput): Promise<ProviderTransferResult | null>;
```

`CreatePayoutTransferInput` now includes optional `scaToken` and `requestedById`, and provider transfer results can return external status, payout-request status, and sandbox-only metadata.

### Airwallex provider

The Airwallex adapter now supports sandbox payout transfer creation through:

```txt
POST /api/v1/transfers/create
```

The request is sent on behalf of the user's Airwallex connected account using the connected-account header and includes:

- sandbox beneficiary ID
- net payout amount
- source/transfer currency
- transfer method
- reason
- request ID
- Hellowhen payout metadata
- optional SCA token

The adapter records the transfer in `MoneyProviderTransaction` with `type=payout`, then updates the linked `PayoutRequest` provider fields:

```txt
provider=airwallex
providerAccountId
providerTransferId
providerPayoutId
providerExternalStatus
providerFailureCode
providerFailureMessage
```

### Provider status sync

Admins and webhooks can sync Airwallex payout transfer status through:

```txt
GET /api/v1/transfers/{transferId}
```

The sync path updates:

- `MoneyProviderTransaction.status`
- `PayoutRequest.providerExternalStatus`
- `PayoutRequest.status`
- `PayoutRequest.paidAt` if the provider result maps to paid
- provider failure fields if the provider result maps to failed

### Airwallex webhooks

The Airwallex webhook receiver now attempts to process transfer-style events in addition to connected-account events. Matching payout events are stored as `MoneyProviderEvent` records and can trigger payout transfer sync.

Webhook processing remains disabled unless:

```env
MONEY_PROVIDER_WEBHOOKS_ENABLED=true
AIRWALLEX_ENABLED=true
```

## Admin changes

### Admin payout console

`/admin/payouts` now shows provider-aware payout information:

- active provider status
- provider account attached to the payout
- provider transfer/payout ID
- provider external status
- provider failure message
- provider transactions
- provider events
- Stripe fallback/legacy event history

Admins can now run:

```txt
POST /admin/payouts/:payoutId/provider-sync
```

This syncs the Airwallex sandbox transfer status for a linked payout.

Admin `approve` and `retry` can create a provider payout transfer when:

- payout provider is `airwallex`
- payout has a provider account
- `MONEY_PROVIDER_PAYOUTS_ENABLED=true`
- Airwallex sandbox connected accounts are configured
- sandbox beneficiary ID is configured

### Admin money page

`/admin/money` now labels provider records as broader money transactions rather than only trade-money transactions, because the table can now include payout transfers.

## Money-safety changes

`providerTransfersEnabled` can now be true in sandbox/demo mode when all required provider flags are intentionally enabled. Production money still requires the production launch-mode switch.

This allows Airwallex sandbox payout testing without weakening the first-beta default state.

## What is intentionally not done

Phase 21.5 does not add:

- real production Airwallex payouts
- user bank-account collection
- beneficiary creation UI
- embedded beneficiary component
- user payout self-service in public beta
- pay-ins
- lifetime wallet balances
- automatic payout retries
- tax/compliance documents
- country-by-country rollout approval

## Follow-up work

Before production, Hellowhen still needs:

1. Confirm beneficiary collection flow with Airwallex.
2. Add embedded or hosted beneficiary setup if approved.
3. Add country/currency payout capability checks.
4. Add payout retry/failure reason normalization.
5. Add admin reconciliation between Hellowhen ledger and Airwallex transfers.
6. Add support playbooks for failed, returned, or compliance-held payouts.
7. Complete legal/provider review before any production launch.
