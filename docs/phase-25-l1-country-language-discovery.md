# Phase 25.L1 — Country/language-aware discovery and localized starter/library content

Date: 2026-05-14

## Goal

Make discovery and starter/library content feel more relevant for English and French users without hiding safe global content or changing feed/deck behavior.

## Implemented

- Added locale metadata to `InventoryTemplate`:
  - `languageCode`
  - `countryCode`
- Added a migration for the new template locale fields.
- Added French Hellowhen starter Need/Offer templates.
- Updated template listing to resolve viewer locale from:
  1. explicit `language` / `countryCode` query params,
  2. signed-in user settings/profile,
  3. `Accept-Language`,
  4. English fallback.
- Updated web and native starter-library callers to pass the resolved app language and signed-in profile country.
- Added feed ranking boosts for:
  - viewer country matching trade owner country,
  - viewer language matching trade owner app language.
- Kept country/language as ranking boosts, not hard filters.
- Kept restricted-owner/hidden/closed/expired public-content protections unchanged.

## Product rules

- Exact language match should rank higher.
- Exact country match should rank higher, especially for local posts.
- Global/remote content should still remain discoverable.
- Starter library content should prefer the account/app language and fall back to English only when no localized starter items are available.
- Country-specific starter items should only appear for matching country users; global starter items remain available to everyone.

## Non-goals

- No automatic translation of user-generated titles, descriptions, proposals, or messages.
- No hard geo-blocking.
- No changes to feed/deck visuals, swipe behavior, or proposal logic.
- No wallet, payout, Stripe, Airwallex, or money-provider changes.

## QA checklist

1. Set app language to English and open starter Needs/Offers.
   - English starter items should appear first.
2. Set app language to French and open starter Needs/Offers.
   - French starter items should appear first.
3. Use a French profile country (`FR`).
   - France-local starter items can appear with French/global items.
4. Refresh the trade feed while signed in with a country/language preference.
   - Matching owner country/language should be boosted, but other safe content should remain discoverable.
5. Confirm restricted users and hidden/closed/expired content still do not appear publicly.
