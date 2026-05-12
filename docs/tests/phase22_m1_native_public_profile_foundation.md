# Phase 22.M1 — Native public profile API/navigation smoke checklist

Scope: native public profile route and screen foundation only.

## Manual checks

1. Start API and mobile app.
2. Navigate programmatically or from a temporary dev call to:
   - `navigation.navigate('UserProfile', { userId: '<existing-user-id>' })`
3. Confirm the screen loads:
   - avatar or fallback initial
   - display name / handle
   - bio when available
   - country code when available
   - member since
   - completed trades count
   - active trades count
   - open needs count
   - open offers count
4. Pull to refresh the profile screen.
5. Turn off API or use a missing user ID and confirm the retry/error state appears.
6. Tap public post cards and confirm they navigate to `TradeDetail`.
7. Confirm no private data appears:
   - no email
   - no phone
   - no wallet balances
   - no private settings
   - no support/private proposal thread content

## Not in this phase

- Replacing native owner/proposer text with clickable identity rows.
- Adding `UserAvatar` / `UserIdentityPressable` shared native components.
- Changing swipe/deck behavior.
- Changing proposal or wallet logic.
