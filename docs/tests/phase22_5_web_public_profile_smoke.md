# Phase 22.5 — Web public profile smoke test

Scope: public profile navigation and clickable identity polish only. Do not change proposal logic, wallet logic, feed animations, or native mobile behavior.

## Smoke checklist

1. Open `/users/:userId` directly.
   - Profile loads when the user exists.
   - Missing/deleted user shows the unavailable state.
   - Retry button attempts to load again.
   - Back to trades returns to `/trades`.

2. Click identity links from key web surfaces.
   - Trade detail owner row opens `/users/:ownerId`.
   - Proposal applicant row opens `/users/:applicantId` without selecting the proposal card by accident.
   - Conversation sender identity opens `/users/:senderId` without submitting or changing proposal state.
   - Trade list/card owner identity opens the public profile.
   - Trade card body still opens `/trades/:tradeId`.

3. Avatar and media fallbacks.
   - Missing avatar shows fallback initial.
   - Broken avatar URL falls back to the initial.
   - Missing/broken public post image falls back to the semantic Need/Offer/Trade icon tile.

4. Mobile web layout.
   - Public profile stats wrap into two columns on narrow screens.
   - Public post cards remain readable at small widths.
   - Bottom tab shell stays visible and highlights Trades while viewing `/users/:userId`.

5. Privacy check.
   - Public profile shows only public-safe profile fields, public counts, and public active posts.
   - It does not show email, phone, wallet data, settings, private proposal threads, support info, or payout data.
