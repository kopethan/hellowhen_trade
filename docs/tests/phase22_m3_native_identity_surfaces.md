# Phase 22.M3 — Native identity surfaces smoke checklist

Scope: native trade detail and proposal identity surfaces only.

## Trade detail

- Open a public trade detail.
- Confirm the hero shows `Posted by` followed by avatar/name identity.
- Tap the owner identity and confirm it opens `UserProfile` for that user.
- Confirm the trade details section shows clickable Owner identity.
- If the trade has a provider, confirm the Provider row is clickable.
- Confirm missing avatar falls back to the initial.

## Proposal list inside trade detail

- As trade owner, open a trade with proposals.
- Confirm each proposal row shows applicant avatar/name as a pressable identity.
- Tap applicant identity and confirm it opens the applicant public profile.
- Confirm Accept / Decline buttons still work.
- Confirm Open private thread still works.

## Inline proposal conversation

- Open a proposal conversation visible inside trade detail.
- Confirm sender labels show avatar/name identity instead of plain text.
- Tap another sender identity and confirm it opens the correct public profile.
- Confirm sending replies still works.

## Proposal detail screen

- Open a proposal detail thread.
- Confirm Owner and Applicant boxes show pressable avatar/name identities.
- Confirm message sender labels use avatar/name identity.
- Confirm Accept / Decline / Withdraw actions still work.
- Confirm Open trade detail still works.

## Non-regression

- No changes to swipe/deck behavior.
- No changes to proposal accept/decline business logic.
- No wallet/money logic changes.
- No web or backend changes.
