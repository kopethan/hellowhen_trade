# Patch 3 - Real Trade Flow MVP

Patch 3 keeps Hellowhen trade-first and fake-credit only.

## Added

- API status endpoint: `PATCH /trades/:tradeId/status`
- Mobile Trade Detail actions:
  - Start / Accept
  - Mark Completed
  - Cancel
  - local Save / Pass placeholders
- Fake ledger movements:
  - `starting_demo_credits`
  - `trade_hold`
  - `trade_release`
  - `trade_refund`
  - `earned_pending`
- Wallet card with available, held, pending earned, payout-eligible placeholder, and recent ledger entries.
- Pull-to-refresh on Trades, Needs, Offers, Account, and Trade Detail.
- API validation errors return friendly `400 validation_error` responses.

## Still intentionally not added

- Real Stripe
- Real payouts
- Real-money wallet
- Plans
- Old Hellowhen action bar
- Chat/messages
- Notifications
- Admin dashboard
