# Phase 25.P1 — Mobile feed compactness and proposal Need/Offer picker

## Goal

Polish the core trade experience before continuing the broader launch-readiness pass:

- Keep mobile feed/deck cards compact by removing owner identity chips from the card surface.
- Let users attach one active saved Need or Offer when proposing on a complete Need + Offer trade.
- Preserve the existing required proposal-side behavior for Open Need and Open Offer posts.

## Audit findings

- Proposal-side fields already existed in the data model and API contracts: `proposedNeedId` and `proposedOfferId`.
- Web and native proposal composers already supported required inventory selection for Open Need/Open Offer posts.
- The backend previously rejected proposed inventory attachments for complete Need + Offer trades.
- Mobile feed/deck cards still showed owner identity/profile chips, while the web feed did not.

## Implemented changes

### Mobile feed compactness

- Removed owner username/avatar/profile chips from mobile trade feed/deck card components.
- Kept identity/profile surfaces in trade detail, proposal lists, public profiles, account, and admin areas.
- Did not change swipe/deck behavior, timers, card ordering, or card actions.

### Proposal Need/Offer picker

- Complete Need + Offer trades now allow an optional attached active Need or Offer in proposals.
- Open Need posts still require one active Offer from the proposing user.
- Open Offer posts still require one active Need from the proposing user.
- A proposal can attach at most one side: either one Need or one Offer, not both.
- Attached inventory must belong to the proposing user and must be active.
- Restricted-account posting safeguards remain handled by the existing authenticated active-account middleware and visibility rules.

### Web and native UI

- Proposal composers now load active saved Needs and Offers for complete trades.
- Users can select or deselect one attached Need/Offer before sending the proposal.
- Selecting a Need clears the selected Offer, and selecting an Offer clears the selected Need.
- Existing proposal preview cards are reused so the owner can see the attached item with the proposal.
- Added English and French strings for optional proposal attachments and inventory-loading errors.

## Non-goals

- No wallet, payout, Stripe, Airwallex, or money-provider behavior was enabled.
- No feed/deck interaction behavior was changed beyond removing identity chips from mobile cards.
- No proposal acceptance or trade-status business logic was changed for complete Need + Offer trades.
- No legal/policy user-facing copy was changed in this phase.

## Manual QA checklist

1. Mobile Trades feed: verify cards no longer show owner username/avatar/profile chips.
2. Mobile Trade Detail: verify owner identity still appears on the detail page.
3. Web Trade Detail on a complete Need + Offer trade: send a proposal with no attachment.
4. Web Trade Detail on a complete Need + Offer trade: attach one active Offer and send.
5. Web Trade Detail on a complete Need + Offer trade: attach one active Need and send.
6. Native Trade Detail: repeat the same complete-trade proposal checks.
7. Open Need: verify proposing still requires an active Offer.
8. Open Offer: verify proposing still requires an active Need.
9. Restricted user: verify proposal creation is still blocked by account-status middleware.
10. Owner view: verify attached proposal Need/Offer previews are visible in the proposal list.
