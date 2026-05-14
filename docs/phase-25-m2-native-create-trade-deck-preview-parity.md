# Phase 25.M2 — Native create-trade deck preview parity

## Goal

Make the native Create Trade deck preview use the same square swipe deck presentation as the native Trades feed.

## What changed

- Added a shared native `TradeSquareDeck` component for trade square-deck rendering.
- Updated the native feed to use the shared component without changing feed behavior.
- Updated the native Create Trade preview to use the shared component instead of a smaller preview-only deck configuration.
- Removed the constrained 320px preview sizing that caused compressed text and countdown overlap.
- Kept the Create Trade preview inside the form, but let the deck use the feed deck sizing and gesture behavior.
- Kept preview cards non-navigating by not passing an open-detail handler from Create Trade.

## Safety / non-goals

- No web changes.
- No proposal changes.
- No publish/create-trade API changes.
- No feed ranking changes.
- No money, wallet, payout, Stripe, or Airwallex changes.

## QA checklist

- Open native Create Trade.
- Select a complete Need + Offer trade type.
- Select a saved Need and saved Offer.
- Confirm the preview summary card no longer overlaps title/meta/countdown text.
- Swipe the preview deck if the selected Need/Offer has images.
- Confirm vertical form scrolling still works outside the preview deck.
- Publish a trade and confirm create behavior is unchanged.
- Open the native Trades feed and confirm feed deck behavior is unchanged.
