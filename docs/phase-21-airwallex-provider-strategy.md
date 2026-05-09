# Phase 21.0 — Airwallex provider strategy and money-provider architecture

Status: strategy only. No runtime code changes.

## Product decision

The first beta launch stays money-off:

- no wallet for normal users
- no payouts for normal users
- no money trades
- no cash or off-platform money flow
- service / goods / other Need + Offer exchanges only
- wallet, Stripe, payout, and admin money code stays in the repo but remains hidden and blocked behind flags
- no user-facing "credits" language should return to the launch product

Airwallex is the preferred future international money provider for a second launch, but it must start in sandbox/demo mode only. Hellowhen must keep its own ledger as the product source of truth, with the external provider treated as the money rail and external balance mirror.

## Current repo audit summary

### Existing money flags

The repo already has launch and visibility gates:

```env
MONEY_LAUNCH_MODE=disabled
MONEY_PRODUCTION_ENABLED=false
MONEY_FEATURES_VISIBLE=false
WALLET_VISIBLE=false
PAYOUTS_VISIBLE=false
MONEY_TRADES_ENABLED=false
CASH_TRADES_ENABLED=false
NEXT_PUBLIC_MONEY_FEATURES_VISIBLE=false
NEXT_PUBLIC_WALLET_VISIBLE=false
NEXT_PUBLIC_PAYOUTS_VISIBLE=false
NEXT_PUBLIC_MONEY_TRADES_ENABLED=false
NEXT_PUBLIC_CASH_TRADES_ENABLED=false
EXPO_PUBLIC_MONEY_FEATURES_VISIBLE=false
EXPO_PUBLIC_WALLET_VISIBLE=false
EXPO_PUBLIC_PAYOUTS_VISIBLE=false
EXPO_PUBLIC_MONEY_TRADES_ENABLED=false
EXPO_PUBLIC_CASH_TRADES_ENABLED=false
```

The API safety layer already blocks wallet top-up, payout-account setup, payout requests, and money trades when launch/visibility flags are off.

### Missing provider flag

The repo does not yet have a true provider selection layer:

```env
MONEY_PROVIDER=none | stripe | airwallex
```

Current state:

```txt
Launch-mode abstraction: yes
Provider abstraction: no
Stripe implementation: directly coupled
Airwallex implementation: not present
```

### Stripe coupling locations

Stripe is still directly coupled in backend runtime paths:

```txt
apps/api/src/modules/stripe/stripeConnect.ts
apps/api/src/modules/stripe/stripeWebhook.routes.ts
apps/api/src/modules/credits/stripeClient.ts
apps/api/src/modules/wallet/wallet.routes.ts
apps/api/src/app.ts
```

Stripe-specific routes and concepts currently exist:

```txt
/stripe/webhook
/wallet/stripe-connect
/wallet/stripe-connect/account-link
/wallet/stripe-connect/sync
/admin/stripe/connect-accounts
/admin/stripe/events
```

Stripe-specific Prisma models and fields currently exist:

```txt
StripeConnectAccount
StripeEvent
PayoutRequest.stripeConnectAccountId
PayoutRequest.stripeTransferId
PayoutRequest.stripePayoutId
PayoutRequest.stripeEventId
PayoutRequest.stripeFailureCode
PayoutRequest.stripeFailureMessage
PayoutRequest.stripeExternalStatus
CreditPurchase.stripeCheckoutSessionId
CreditPurchase.stripePaymentIntentId
```

Stripe-specific contract and API-client concepts exist in:

```txt
packages/contracts/src/wallet.ts
packages/api-client/src/index.ts
```

Examples:

```txt
stripe_demo
stripe_connect_test
stripeConnectConfigured
stripeConnectTransferMode
stripeTransfersEnabled
stripeConnectAccountLinkResponseSchema
```

### Remaining legacy money wording

The repo still contains internal `credits` and `Credit*` names from earlier phases. This is acceptable while hidden, but any future public money-provider work should avoid bringing `credits` back into user-facing product copy.

Examples:

```txt
apps/api/src/modules/credits/*
apps/web/src/app/credits/*
apps/mobile/src/features/account/BuyCreditsScreen.tsx
CreditPurchase
CreditLedgerEntry
SupportTicketCategory.credits_issue
```

Phase 21.0 does not rename these. Later phases should isolate or rename public-facing labels before production money.

## Provider architecture recommendation

Add provider selection beside the existing launch mode:

```env
MONEY_PROVIDER=none
MONEY_LAUNCH_MODE=disabled
```

Allowed providers:

```txt
none      no external money provider; first beta default
stripe    existing Stripe Connect / checkout implementation, isolated as fallback/reference
airwallex future sandbox/provider implementation
```

Launch mode remains separate:

```txt
disabled      all money actions blocked
demo          demo/sandbox-only UX; no production money
private_beta  allowlisted users only
production    live money only after explicit production switch and provider approval
```

Expected matrix:

| MONEY_PROVIDER | MONEY_LAUNCH_MODE | Meaning |
| --- | --- | --- |
| none | disabled | First beta. No wallet, no payouts, no money trades. |
| stripe | demo/private_beta | Existing Stripe test-mode fallback/reference. |
| airwallex | demo | Airwallex sandbox only. No production money. |
| airwallex | private_beta | Future allowlisted money beta only. |
| airwallex | production | Future production only after provider/legal/compliance approval. |

## Backend provider interface

Introduce provider-neutral backend modules in Phase 21.1:

```txt
apps/api/src/modules/money/providers/moneyProvider.types.ts
apps/api/src/modules/money/providers/moneyProviderRegistry.ts
apps/api/src/modules/money/providers/noneMoneyProvider.ts
apps/api/src/modules/money/providers/stripeMoneyProvider.ts
apps/api/src/modules/money/providers/airwallexMoneyProvider.ts
```

Recommended TypeScript shape:

```ts
export type MoneyProviderName = 'none' | 'stripe' | 'airwallex';

export type MoneyProviderCapability =
  | 'connected_accounts'
  | 'onboarding_links'
  | 'wallet_balances'
  | 'payins'
  | 'trade_holds'
  | 'platform_fees'
  | 'payouts'
  | 'webhooks'
  | 'refunds'
  | 'disputes';

export interface MoneyProvider {
  name: MoneyProviderName;
  capabilities(): MoneyProviderCapability[];

  createConnectedAccount(input: CreateConnectedAccountInput): Promise<ConnectedAccountResult>;
  createOnboardingLink(input: CreateOnboardingLinkInput): Promise<OnboardingLinkResult>;
  syncConnectedAccountStatus(input: SyncConnectedAccountInput): Promise<ConnectedAccountStatusResult>;

  syncWalletBalances(input: SyncWalletBalancesInput): Promise<WalletBalanceSyncResult>;

  createPayIn(input: CreatePayInInput): Promise<PayInResult>;

  reserveTradeFunds(input: TradeHoldInput): Promise<TradeHoldResult>;
  releaseTradeFunds(input: TradeReleaseInput): Promise<TradeReleaseResult>;
  refundTradeFunds(input: TradeRefundInput): Promise<TradeRefundResult>;

  collectPlatformFee(input: PlatformFeeInput): Promise<PlatformFeeResult>;

  createPayoutRequest(input: ProviderPayoutInput): Promise<ProviderPayoutResult>;

  handleWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult>;

  reverseTransfer(input: ProviderReversalInput): Promise<ProviderReversalResult>;
}
```

The `none` provider should be a real implementation that safely rejects all money movement. Do not rely on null checks for safety.

## Provider responsibilities

### Connected account creation

Provider-neutral API:

```txt
POST /money/provider-account
```

Provider behavior:

- `none`: return 403 `money_provider_disabled`
- `stripe`: create or return Stripe Connect test account
- `airwallex`: create Airwallex connected account in sandbox only

### Onboarding link

Provider-neutral API:

```txt
POST /money/provider-account/onboarding-link
```

Provider behavior:

- `none`: blocked
- `stripe`: create Connect account link
- `airwallex`: create hosted or embedded KYC/KYB onboarding link/session

### Account status sync

Provider-neutral API:

```txt
POST /money/provider-account/sync
```

Sync should update:

```txt
status
capabilities
currently due / eventually due / past due requirements
country
currency
lastSyncedAt
provider raw status snapshot
```

### Wallet balance sync

Provider-neutral API:

```txt
POST /money/wallet/sync
```

Provider behavior:

- Airwallex: read connected-account wallet balances per currency
- Stripe: map existing balance/account status where available
- Hellowhen: never replace ledger state blindly; reconcile provider balances against the Hellowhen ledger

### Pay-in

Provider-neutral API:

```txt
POST /money/payins
```

Future behavior:

- sandbox only until production approval
- Hellowhen ledger creates a pending pay-in record
- provider confirms via webhook or sync
- Hellowhen ledger marks funds available only after provider confirmation

### Trade hold and release

Hellowhen should keep trade holds in its own ledger first. Provider movement may occur immediately, later, or not at all depending on the selected provider and approved funds flow.

Required logical states:

```txt
available -> held -> released
available -> held -> refunded
released -> payout_requested -> payout_paid
released -> dispute_hold -> refund_or_release
```

### Platform fee

Keep the current product rule:

```txt
Platform fee: 10% of payout-eligible earnings
```

The provider layer should support both approaches:

```txt
Option A: deduct fee before crediting seller payout-eligible balance
Option B: credit gross, then charge platform fee from seller wallet
```

Recommended initial implementation: Option A.

### Payout request

Provider-neutral API:

```txt
POST /money/payouts
```

Rules:

- require provider verification before real payout
- keep manual admin review on
- block payout when a linked trade is disputed
- store gross, fee, and net amounts on every payout request
- write provider IDs only after provider action starts

### Webhooks

Move toward:

```txt
POST /money/webhooks/:provider
```

Existing `/stripe/webhook` can remain during migration, but new Airwallex code should land under the provider-neutral webhook structure.

### Refunds and disputes

Disputes remain a Hellowhen product-state problem first. Provider reversals/refunds are external consequences of admin decisions.

Required rule:

```txt
Do not auto-release or auto-payout a disputed trade.
```

## Database additions for Phase 21.1+

Do not delete Stripe tables yet. Add provider-agnostic records beside them.

### MoneyProviderAccount

```prisma
model MoneyProviderAccount {
  id                    String   @id @default(cuid())
  userId                String?
  businessProfileId     String?
  provider              String
  providerAccountId     String
  accountType           String   @default("individual")
  status                String   @default("not_started")
  country               String?
  defaultCurrency       String?
  capabilitiesJson      Json?
  requirementsJson      Json?
  rawProviderStatusJson Json?
  lastSyncedAt          DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([provider, providerAccountId])
  @@index([userId, provider, status])
  @@index([businessProfileId, provider, status])
}
```

### MoneyProviderWalletBalance

```prisma
model MoneyProviderWalletBalance {
  id                     String   @id @default(cuid())
  providerAccountRecordId String
  provider               String
  currency               String
  availableCents         Int      @default(0)
  reservedCents          Int      @default(0)
  pendingCents           Int      @default(0)
  rawProviderBalanceJson Json?
  externalUpdatedAt      DateTime?
  lastSyncedAt           DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@unique([providerAccountRecordId, currency])
  @@index([provider, currency])
}
```

### MoneyProviderTransaction

```prisma
model MoneyProviderTransaction {
  id                                String   @id @default(cuid())
  provider                          String
  providerTransactionId              String?
  type                              String
  status                            String
  userId                            String?
  tradeId                           String?
  payoutRequestId                   String?
  amountCents                       Int
  currency                          String
  providerAccountRecordId           String?
  counterpartyProviderAccountRecordId String?
  rawProviderStatusJson             Json?
  createdAt                         DateTime @default(now())
  updatedAt                         DateTime @updatedAt

  @@unique([provider, providerTransactionId])
  @@index([provider, type, status])
  @@index([userId, createdAt])
  @@index([tradeId])
  @@index([payoutRequestId])
}
```

### MoneyProviderEvent

```prisma
model MoneyProviderEvent {
  id                      String   @id @default(cuid())
  provider                String
  providerEventId          String
  eventType               String
  providerAccountRecordId String?
  status                  String   @default("received")
  payloadJson             Json?
  error                   String?
  processedAt             DateTime?
  createdAt               DateTime @default(now())

  @@unique([provider, providerEventId])
  @@index([provider, eventType, createdAt])
  @@index([status, createdAt])
}
```

### PayoutRequest additions

Add provider-neutral fields while keeping old Stripe fields for compatibility:

```txt
provider
providerAccountRecordId
providerTransferId
providerPayoutId
providerEventId
providerFailureCode
providerFailureMessage
providerExternalStatus
```

Mark existing Stripe fields as legacy after the provider-neutral fields exist.

### Trust tier rename later

Current enum:

```txt
new | email_verified | stripe_verified | trusted | restricted
```

Future provider-neutral enum should be:

```txt
new | email_verified | provider_verified | trusted | restricted
```

Do not rename this in Phase 21.0. Plan the migration for a later provider-neutral safety phase.

## Env flags to add in Phase 21.1

Provider selection:

```env
MONEY_PROVIDER=none
MONEY_PROVIDER_SANDBOX_ONLY=true
```

Provider feature gates:

```env
MONEY_PROVIDER_ACCOUNT_CREATION_ENABLED=false
MONEY_PROVIDER_WALLET_SYNC_ENABLED=false
MONEY_PROVIDER_PAYINS_ENABLED=false
MONEY_PROVIDER_TRADE_MONEY_ENABLED=false
MONEY_PROVIDER_PAYOUTS_ENABLED=false
MONEY_PROVIDER_WEBHOOKS_ENABLED=false
```

Airwallex sandbox config:

```env
AIRWALLEX_ENABLED=false
AIRWALLEX_ENV=demo
AIRWALLEX_BASE_URL=https://api-demo.airwallex.com
AIRWALLEX_CLIENT_ID=
AIRWALLEX_API_KEY=
AIRWALLEX_WEBHOOK_SECRET=
AIRWALLEX_PLATFORM_ACCOUNT_ID=
AIRWALLEX_DEFAULT_CURRENCY=eur
AIRWALLEX_CONNECTED_ACCOUNTS_ENABLED=false
AIRWALLEX_KYC_ONBOARDING_MODE=hosted
AIRWALLEX_DEFAULT_ACCOUNT_TYPE=individual
```

Keep existing Stripe envs until Airwallex is proven:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_ENABLED=false
STRIPE_CONNECT_TRANSFER_MODE=false
```

## Admin visibility needed

Add provider-neutral admin views before any real money returns.

Recommended future admin routes:

```txt
/admin/money/safety
/admin/money/provider-accounts
/admin/money/provider-events
/admin/money/wallet-balances
/admin/money/payouts
/admin/money/reconciliation
/admin/money/disputes
```

Required admin data:

```txt
provider
launch mode
public money flags
production switch status
private beta allowlist count
provider account status
KYC/KYB requirement state
wallet balances by currency
Hellowhen ledger exposure
provider balance exposure
pending payouts gross/fee/net
provider events received/processed/failed
linked trade disputes
manual admin actions and notes
```

Existing Stripe admin routes should stay until replaced:

```txt
/admin/stripe/connect-accounts
/admin/stripe/events
```

They should later become filtered views of provider-neutral records.

## Mobile and web behavior

### MONEY_PROVIDER=none

This is the first beta state.

Tabs stay:

```txt
Trades | Needs | Offers | Account
```

Allowed:

```txt
Need + Offer trades
service / goods / other inventory
public trade feed
trade detail
proposals
account/profile/settings/support
```

Hidden or blocked:

```txt
Wallet
Payouts
Add money
Buy credits
Cash trade
Money trade
Provider onboarding
Bank payout setup
```

Backend must return 403 for:

```txt
wallet top-up
money trade
cash trade
payout account setup
payout request
provider transfer
provider webhook action that moves money
```

Direct routes should render a money-off notice or redirect to Account, but backend 403 is the real safety layer.

### MONEY_PROVIDER=airwallex + demo

Only show sandbox UI when all of these are true:

```env
MONEY_PROVIDER=airwallex
MONEY_LAUNCH_MODE=demo
MONEY_FEATURES_VISIBLE=true
AIRWALLEX_ENABLED=true
AIRWALLEX_ENV=demo
```

User-facing copy must say:

```txt
Airwallex sandbox
No real money
Demo balances only
Provider testing mode
```

Allowed sandbox UI:

```txt
Account -> Money setup sandbox
Account -> Wallet sandbox
Account -> Payouts sandbox
Admin -> Provider accounts
Admin -> Provider events
Admin -> Reconciliation
```

Production language must not appear in sandbox:

```txt
Add real money
Withdraw money
Bank payout ready
```

Money trades should remain blocked unless:

```env
MONEY_TRADES_ENABLED=true
MONEY_PROVIDER_TRADE_MONEY_ENABLED=true
```

## Airwallex fit for Hellowhen

Airwallex Connected Accounts are relevant because they let platforms create and manage accounts for customers such as individuals, businesses, merchants, or service providers. Connected accounts can have their own multi-currency wallets, capabilities, identity verification, transaction history, and reporting.

Airwallex supports business and individual connected accounts, which maps well to Hellowhen users now and future brand/business accounts later.

Airwallex offers hosted, embedded, and API-based KYC onboarding options. Hellowhen should start with hosted or embedded onboarding, not native API onboarding, because native onboarding increases technical and compliance burden.

Airwallex's payout network is broad, but capability availability still depends on country, account type, currency, funds flow, and provider approval. Hellowhen needs a country-by-country launch map before production.

## Airwallex production questions to verify

Ask Airwallex before any production implementation:

1. Can Hellowhen onboard both individuals and businesses as connected accounts in the first launch countries?
2. Are consumer-to-consumer service/goods trades allowed under Airwallex acceptable-use and underwriting rules?
3. Can connected-account wallets hold user balances over time, and what dormancy rules apply?
4. Which countries support individual accounts, business accounts, wallet balances, pay-ins, and payouts?
5. Can Hellowhen delay seller payout until payer confirmation and manual admin review?
6. Can Hellowhen split funds into seller earnings, platform fee, refund reserve, and dispute hold?
7. What wallet caps, payout caps, account closure rules, and dormant balance rules apply?
8. What are the exact pay-in, payout, FX, dispute, chargeback, KYC/KYB, webhook, and monthly/platform fees?
9. Does Airwallex require same-name payout for any Hellowhen-supported country or funds flow?
10. Which legal entity country gives Hellowhen the best launch coverage?
11. What API scopes are needed for connected accounts, wallets, payouts, webhooks, and hosted onboarding?
12. What production review is required before enabling real users?
13. Are brand/enterprise campaign flows supported where a business posts Needs and creators/users submit proposals?
14. Can Hellowhen start with sandbox connected accounts before production approval?

## Stripe decision

Do not delete Stripe yet.

Recommended path:

```txt
Now: keep Stripe disabled behind existing flags.
Phase 21.1: wrap Stripe behind MoneyProvider.
Phase 21.2+: add Airwallex sandbox provider beside Stripe.
Later: migrate Stripe-specific records to provider-neutral records.
Final: remove Stripe only after Airwallex production is approved and historical records are migrated or archived.
```

Stripe is useful as a reference implementation and fallback until Airwallex is proven. The risk is not Stripe existing in the repo; the risk is Stripe concepts leaking into provider-neutral product state.

## Staged roadmap

### Phase 21.0 — provider strategy only

This document only.

Deliverables:

```txt
repo money architecture audit
Stripe coupling map
provider abstraction recommendation
database addition plan
env flag plan
admin visibility plan
mobile/web behavior matrix
Airwallex production questions
Stripe keep/isolate/remove recommendation
```

### Phase 21.1 — provider abstraction scaffolding

Goal:

```txt
Introduce MONEY_PROVIDER without changing first-beta behavior.
```

Scope:

```txt
Add provider enum and env parsing.
Add none provider.
Wrap existing Stripe code as stripe provider.
Add Airwallex stub provider that returns safe not-configured errors.
Make money safety provider-neutral.
Make wallet/payout contracts provider-neutral.
Keep all public money flags false.
```

Expected files:

```txt
.env.example
apps/api/src/config/env.ts
apps/api/src/modules/money/moneySafety.ts
apps/api/src/modules/money/providers/moneyProvider.types.ts
apps/api/src/modules/money/providers/moneyProviderRegistry.ts
apps/api/src/modules/money/providers/noneMoneyProvider.ts
apps/api/src/modules/money/providers/stripeMoneyProvider.ts
apps/api/src/modules/money/providers/airwallexMoneyProvider.ts
apps/api/src/modules/wallet/wallet.routes.ts
apps/api/src/modules/credits/credits.routes.ts
apps/api/src/modules/trades/trades.routes.ts
apps/api/src/modules/proposals/proposals.routes.ts
apps/api/src/modules/admin/admin.routes.ts
packages/contracts/src/wallet.ts
packages/api-client/src/index.ts
apps/mobile/src/env.d.ts
apps/mobile/src/lib/moneyPreferences.ts
apps/web/src/lib/webMoneyPreferences.ts
```

### Phase 21.2 — Airwallex sandbox connected accounts

Goal:

```txt
Create and onboard Airwallex connected accounts in sandbox only.
```

Scope:

```txt
Airwallex authentication/token helper
connected account creation
hosted or embedded onboarding session/link
account status sync
provider webhook receiver
admin provider-account viewer
admin/manual-only sandbox access
```

### Phase 21.3 — Airwallex wallet balance sync

Goal:

```txt
Read provider wallet balances and reconcile them against Hellowhen ledger state.
```

Scope:

```txt
per-currency provider balances
manual/admin sync
provider event storage
admin reconciliation view
read-only user sandbox wallet view
```

### Phase 21.4 — Airwallex trade money sandbox

Goal:

```txt
Test sandbox money trades without enabling public production money.
```

Scope:

```txt
sandbox pay-in
Hellowhen ledger hold
trade confirmation release
platform fee calculation
refund/dispute reversal path
ledger-provider reconciliation
```

### Phase 21.5 — Airwallex payouts sandbox

Goal:

```txt
Test payout request, admin review, provider payout, and webhook status updates.
```

Scope:

```txt
payout creation
admin approve/pause/reject/retry
provider status sync
failure reason handling
provider event viewer
```

### Phase 21.6 — business/brand accounts

Goal:

```txt
Prepare Hellowhen for agencies, businesses, and big brands.
```

Scope:

```txt
business profile
KYB onboarding
brand verification badge
team/member groundwork
higher limits by admin approval
brand campaign/trade flows
```

## Risks

### Compliance risk

Wallet balances, delayed payouts, internal transfers, consumer marketplace trades, and cross-border money movement can trigger regulatory obligations. Do not enable lifetime balances or production payouts until provider/legal review is complete.

### Provider migration risk

Stripe IDs already exist in schema, routes, contracts, and admin flows. Airwallex should be added beside Stripe first, not by ripping Stripe out.

### Stripe leftover risk

`StripeConnectAccount`, `StripeEvent`, `/credits`, `BuyCredits`, and `stripe_verified` remain in the repo. They are acceptable while hidden, but they should be isolated before Airwallex production.

### International rollout risk

Airwallex coverage is broad but not uniform. Country, legal entity, account type, payout method, currency, and funds-flow approval all matter.

### Ledger reconciliation risk

Hellowhen's ledger must explain the product state. Provider balances can lag, fail, reverse, or differ by currency.

### Refund/dispute risk

Refunds are safest before seller payout. Once funds move to a connected wallet or external bank, reversals become provider- and country-dependent.

### First-beta leakage risk

The repo mostly hides money features when flags are off, but direct routes and admin pages still exist. Backend 403 gates must remain strict.

## Official Airwallex references checked

- Connected Accounts overview: https://www.airwallex.com/docs/connected-accounts/overview
- Get started with connected accounts: https://www.airwallex.com/docs/connected-accounts/get-started/get-started-with-connected-accounts
- KYC and onboarding: https://www.airwallex.com/docs/connected-accounts/onboarding/kyc-and-onboarding
- Hosted onboarding: https://www.airwallex.com/docs/connected-accounts/onboarding/kyc-and-onboarding/hosted-onboarding
- Embedded KYC component: https://www.airwallex.com/docs/connected-accounts/onboarding/kyc-and-onboarding/embedded-kyc-component
- KYB and onboarding: https://www.airwallex.com/docs/connected-accounts/onboarding/kyb-and-onboarding
- Payout network: https://www.airwallex.com/docs/payouts/payout-network
- Market and infrastructure coverage: https://www.airwallex.com/docs/global-treasury/market-and-infrastructure-coverage
- Pricing examples: https://www.airwallex.com/fr-en/pricing
