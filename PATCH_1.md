# Patch 1 - Create new repo base structure

## Completed

- Created a fresh `zizilia` monorepo.
- Added apps for API, web, and mobile.
- Added packages for contracts, API client, theme, shared utilities, UI, and trade domain.
- Added Prisma schema draft for User, Profile, Need, Offer, Trade, Wallet, CreditLedgerEntry, TradePayment, TradeEscrow, and PayoutRequest.
- Added fake-credit-first wallet API placeholders.
- Added public Trade Feed and Trade Detail placeholders.
- Added private My Needs, My Offers, My Trades placeholders.
- Added Profile/Me and Settings placeholders.
- Added mobile My Needs, My Offers, Trade Detail shells.
- Added web auth shell and future dashboard placeholder.
- Added new Zizilia placeholder wordmark assets.

## Intentionally Not Migrated

- Plans feature
- old action bar
- old deck/feed/place complexity
- polls/messages/talk/lab screens
- old home navigation assumptions
- production payments
- Stripe/Stripe Connect flows

## Next Patch Suggestion

`Go Patch 2 - Wire auth/profile/settings from the old repo into the new API + mobile/web shells`
