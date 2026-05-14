# Phase 25.M4 — Native create-trade Need/Offer picker create-new parity

## Goal

Bring the native Create Trade Need/Offer picker closer to the web flow by letting users create a new Need or Offer while choosing a side for a trade.

## Implemented

- Added a create-new action to the native saved Need/Offer picker.
- `Create Trade → Choose Need → Create new Need → Save` returns to Create Trade with the new Need selected.
- `Create Trade → Choose Offer → Create new Offer → Save` returns to Create Trade with the new Offer selected.
- The shared native picker still supports proposal selection context and returns to Trade Detail with the newly created item selected.
- New items created from picker flows are saved as `active` so they can immediately be used in public trades/proposals.
- Standalone `Create Need` and `Create Offer` still save as drafts when opened outside picker flows.

## Non-goals

- No web behavior changes.
- No feed/deck behavior changes.
- No proposal acceptance logic changes.
- No backend API changes.
- No wallet, payout, Stripe, or Airwallex changes.

## Smoke checks

- Create Trade → Need picker → create new Need → save → Need appears selected in Create Trade.
- Create Trade → Offer picker → create new Offer → save → Offer appears selected in Create Trade.
- Picker still selects existing Needs/Offers.
- Proposal picker context still returns to Trade Detail with the created item selected.
- Standalone Create Need/Offer still returns normally and saves drafts.
