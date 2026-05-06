# Credit Ledger

Patch 1 supports fake/test credits only.

## Required distinction

- Purchased credits are non-withdrawable spending balance.
- Earned credits can become payout-eligible only after completion and hold period.

## Ledger-first rule

Every balance change must be represented by a `CreditLedgerEntry`.

Do not implement wallet balance as the only source of truth.

## Initial entry types

```txt
test_credit_grant
credit_purchase
trade_hold
trade_release
trade_refund
platform_fee
payout_requested
payout_paid
adjustment
```

## Balance buckets

```txt
purchasedAvailableCredits
earnedPendingCredits
earnedAvailableCredits
heldCredits
```

## Not in Patch 1

- Stripe
- Stripe Connect
- real payment collection
- payout onboarding
- production withdrawals
