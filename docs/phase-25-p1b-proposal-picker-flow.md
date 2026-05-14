# Phase 25.P1b — Proposal picker flow polish

## Goal

Make proposal Need/Offer selection feel like the Create Trade selection flow instead of a dense inline list inside Trade Detail.

## Implemented

- Reused the Trade Side Picker route pattern for proposal selection on native.
- Added web proposal picker routes:
  - `/trades/[tradeId]/propose/choose-need`
  - `/trades/[tradeId]/propose/choose-offer`
  - `/trades/[tradeId]/propose/choose-need/new`
  - `/trades/[tradeId]/propose/choose-offer/new`
- The proposal composer now shows a compact selected Need/Offer preview and opens the picker for careful selection.
- Open Need/Open Offer proposals no longer auto-select the first saved item. Users must choose deliberately.
- Complete Need + Offer trades still allow optional proposal attachment, but only one side can be attached at a time.
- Created Needs/Offers from the proposal picker return to Trade Detail with the new item selected.
- Added English/French copy for the new picker flow.

## Safety boundaries

- No feed/deck behavior changes.
- No proposal acceptance logic changes.
- No wallet/money/payout/provider behavior was enabled.
- Backend proposal validation from Phase 25.P1 remains the source of truth.
