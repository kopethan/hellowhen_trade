# Phase 25.F1 — Feed ranking v1 and refresh diversity

## Goal

Make public discovery feel less static while keeping the launch feed explainable, safe, and compatible with existing web/native clients.

## Implemented

- Extended the public trade feed query with optional `refreshSeed` and `seenTradeIds` inputs.
- Replaced the simple feed ordering with ranking v1:
  - freshness and recent updates
  - expiry urgency without showing expired posts
  - search relevance when a query is active
  - Need/Offer completeness
  - media presence
  - filtered mode/category boosts
  - penalty for money/credit surfaces while launch money remains disabled
  - penalty for items the client has already seen during refreshes
  - deterministic seeded jitter so refreshes can safely vary order
- Added diversity pass after scoring:
  - avoids clustering the same owner repeatedly
  - avoids too many same-category posts in a row
  - avoids over-clustering one post type
- Web feed now sends a per-page refresh seed and includes a small refresh pill.
- Native feed now changes the seed on pull-to-refresh and empty-state refresh.
- Demo/fallback web feed also reshuffles locally by seed.

## Safety behavior preserved

- Public feed eligibility still uses `publicTradeVisibilityWhere`.
- Restricted owners remain hidden from public feed discovery.
- Closed/inactive Needs and Offers remain hidden.
- Expired, non-public, and non-active trades remain hidden.
- Money/wallet/payout/provider behavior remains disabled and unchanged.
- Proposal logic is unchanged.
- Feed/deck card rendering and swipe behavior are unchanged.

## Ranking v1 notes

This is not a heavy recommendation system. It is a deterministic marketplace ordering layer designed for first beta. The server remains the source of truth for eligibility and ordering. Clients only provide a refresh seed and recently seen IDs to help the server vary safe candidates.

Later phases can add country/language boosts, profile preferences, saves/passes/proposals, and category affinity once those events are recorded intentionally.

## Smoke test checklist

1. Open the web trade feed and verify active public trades load.
2. Click the feed refresh pill and verify the order can change while the same filters remain active.
3. Pull-to-refresh the native feed and verify order can change.
4. Apply search/mode/post-type filters and verify the feed still respects filters.
5. Restrict a user in admin and verify their trades do not appear publicly.
6. Close a Need/Offer used by a trade and verify the trade is not discoverable.
7. Confirm money trades remain hidden while launch money flags are disabled.
