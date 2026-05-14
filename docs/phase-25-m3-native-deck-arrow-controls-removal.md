# Phase 25.M3 — Native deck arrow controls removal

## Goal

Remove desktop-style previous/next arrow helper buttons from the native mobile deck so mobile feed and create-trade preview feel touch-native.

## Changes

- Removed the previous-card and next-card overlay buttons from the shared native `ContinuousSquareStackDeck`.
- Kept swipe gesture behavior unchanged.
- Kept the shared `TradeSquareDeck` surface used by native feed and native create-trade preview.
- Kept web desktop behavior untouched.

## Affected native surfaces

- Trades feed deck.
- Create Trade deck preview.
- Any native surface that uses the shared square deck component.

## Non-goals

- No web deck changes.
- No feed ranking changes.
- No proposal logic changes.
- No create-trade API changes.
- No wallet, payout, Stripe, or Airwallex changes.

## Smoke test checklist

- Open native Trades feed and confirm no arrow buttons appear on the deck.
- Swipe forward/backward between summary and image cards.
- Open native Create Trade and confirm the deck preview has no arrow buttons.
- Swipe preview cards inside the deck.
- Scroll the create-trade form outside the deck.
- Confirm Publish Trade still works.
