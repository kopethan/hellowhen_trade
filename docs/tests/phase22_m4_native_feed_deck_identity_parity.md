# Phase 22.M4 native feed/deck identity parity smoke checklist

Scope: native feed/deck identity surfaces only. This phase should not change square-stack swipe physics, proposal status actions, wallet logic, backend API behavior, or web UI.

## Square stack feed

- Open the native Trades tab.
- Confirm every summary card that has an owner preview shows a small avatar/name identity element.
- Tap the owner identity on a summary card and confirm it opens `UserProfile` for that user.
- Tap the rest of the summary card and confirm it still opens `TradeDetail`.
- Swipe the square stack forward/backward and confirm the gesture behavior is unchanged.
- Confirm image cards still behave as full-bleed image/reference cards and open the trade detail when tapped.

## Open Need / Open Offer cards

- Confirm Open Need summary poster cards show owner identity beside the post badge when owner data is available.
- Confirm Open Offer summary poster cards show owner identity beside the post badge when owner data is available.
- Confirm missing owner preview data does not crash the card.

## Legacy deck card component

- Confirm the older `TradeDeckCard` owner panel uses the shared native identity component.
- Confirm the avatar fallback initial appears when the owner has no avatar.
- Confirm owner identity opens `UserProfile` when a real owner id is available.

## Create trade preview guard

- Open Create Trade and view the deck preview.
- Confirm preview cards do not navigate to fake users such as `preview` or `unknown`.

## Privacy

- Confirm feed/deck identity only displays public-safe fields: avatar, display name, and optional handle/status text.
- Confirm no email, phone, wallet, private settings, support, or private proposal thread data appears in feed/deck cards.
