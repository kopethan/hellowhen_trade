# Phase 22.M5 — Native public profile smoke test and polish

Scope: native public profile and identity navigation hardening only. No proposal, wallet, backend, web, or deck mechanics changes.

## Public profile screen

- Open a valid `UserProfile` route with `{ userId }`.
- Confirm the screen loads avatar/fallback initial, display name, optional handle, optional bio, country badge, member-since badge, and stats.
- Pull to refresh and confirm the profile reloads without leaving the screen.
- Turn off the API/server and confirm the unavailable state shows `Try again` and `Back to trades`.
- Open a route with an invalid placeholder id like `preview`, `unknown`, `mock`, or an empty id and confirm no API request is needed and the unavailable state is shown.

## Public post sections

- Confirm `Active trades`, `Open needs`, and `Open offers` render counts and empty states.
- Confirm tapping a public post still opens `TradeDetail`.
- Confirm posts with missing titles use a semantic fallback title instead of showing blank/undefined text.
- Confirm missing or broken post images fall back to the Need / Offer / Trade semantic tile.
- Confirm inactive/flagged media is not used as a public profile preview image.

## Identity pressables

- From Trade Detail owner, proposal applicant, proposal messages, and feed/deck owner chips, tap identity rows and confirm they open `UserProfile`.
- Confirm placeholder owner ids like `preview`, `unknown`, `mock`, `demo`, or `local` do not navigate.
- Confirm tapping an identity chip does not also trigger the parent trade card, proposal card, or deck card action.
- Confirm small chips are still tappable with hit slop on a phone screen.

## Avatar fallback

- Confirm valid remote avatar URLs render.
- Confirm API-relative upload URLs render.
- Confirm broken avatar URLs switch to fallback initial.
- Confirm missing display names use handle or `Hellowhen member` fallback.

## Privacy smoke

Confirm the native public profile screen does not display:

- email
- phone
- wallet balances
- ledger entries
- private settings
- support tickets
- private proposal threads
- private message bodies outside the current authorized proposal screens
