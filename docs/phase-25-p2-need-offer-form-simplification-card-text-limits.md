# Phase 25.P2 — Need/Offer form simplification and card text limits

## Goal

Make Need and Offer creation easier for normal users and protect card layouts from long text on web and native.

## Implemented

- Simplified Need/Offer create forms on native.
- Simplified Need/Offer create/edit forms on web.
- Simplified native Need/Offer edit fields.
- Removed the native Need/Offer card preview from create forms.
- Kept only the main fields visible for first launch:
  - title
  - description
  - exchange mode
  - optional location
  - optional images
- Kept backend-compatible metadata defaults/preservation:
  - new items default to `service`
  - hidden metadata remains supported by API/contracts
  - existing hidden metadata is preserved by web edit forms
- Added shared contract limits for Need/Offer title and description:
  - title: 3–70 characters
  - description: 10–500 characters
- Added user-facing character counters on web and native forms.
- Added exact EN/FR validation copy for too-long title/description and missing mode.
- Added web/native card display protections:
  - titles clamp to two lines
  - descriptions clamp to two lines on list/picker cards
  - metadata rows clamp to one line
  - feed/deck title areas clamp safely

## Non-goals

- No feed ranking changes.
- No proposal acceptance changes.
- No wallet, payout, Stripe, or Airwallex changes.
- No new category/tag system.
- No automatic AI tagging.

## QA checklist

- Create Need on mobile with valid title/description.
- Create Offer on mobile with valid title/description.
- Try title shorter than 3 characters.
- Try description shorter than 10 characters.
- Try long title/description and verify counters/limits.
- Edit Need/Offer on mobile.
- Create/edit Need/Offer on web.
- Verify Need/Offer list cards do not overflow.
- Verify Create Trade picker cards do not overflow.
- Verify proposal picker/attached previews still truncate safely.
- Verify long feed/deck titles use ellipsis/clamping instead of overlapping UI.
