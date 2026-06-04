# MOBILE-UI6 — Mobile launch smoke test

This checklist is the final mobile launch smoke pass after:

1. `MOBILE-UI1 — Mobile detail design foundation`
2. `MOBILE-UI2 — Trade Detail mobile social redesign`
3. `MOBILE-UI3 — Proposal thread / conversation mobile redesign`
4. `MOBILE-UI4 — Need / Offer detail mobile polish`
5. `MOBILE-UI5 — Account + Notifications mobile polish`
6. `MOBILE-UI6 — Final mobile launch smoke test`
7. `MOBILE-QA1 — Mobile reliability and network/error polish`
8. `MOBILE-QA2 — Mobile form validation and upload polish`
9. `MOBILE-QA3 — Mobile privacy/accessibility smoke fixes`
10. `MOBILE-QA4 — Store-readiness mobile checklist`

The goal is not to add new product scope. The goal is to confirm the first-launch mobile app still behaves as a focused 18+ Need / Offer / Trade exchange with private proposal conversations and no exposed money, plans, ads, push, or email-notification features.

## Static smoke command

Run from the repository root:

```powershell
npm run mobile:launch-smoke
npm run mobile:store-readiness
```

This static smoke guard checks:

- mobile first-launch feature flags stay off by default
- visible tabs stay `Trades`, `Needs`, `Offers`, `Account`
- proposal/private thread routes stay auth-protected
- wallet, buy-credit, payout, Pro, and Business routes stay feature-gated
- native Share stays only on the mobile Trade Detail screen
- push/ad/payment SDKs are not added to the mobile app
- the redesigned Trade Detail, Proposal Thread, Need/Offer Detail, Account, and Notifications screens still use the expected shared mobile UI foundation
- MOBILE-QA1 reliability guards stay present: finite API timeout, longer upload timeout, stale feed/notification response guards, duplicate proposal action guards, and retryable notification errors
- MOBILE-QA2 form/upload guards stay present: unsaved-draft warning, upload progress, failed-image upload errors, safe image type/size filtering, and proposal message validation
- MOBILE-QA3 privacy/accessibility guards stay present: safe notification fallback previews, checkbox roles for Terms/18+ confirmation, accessible shared detail actions, and labeled private-thread message options

This does not replace manual device testing.

## Required local commands

Run these after applying the full mobile UI stack:

```powershell
npm run mobile:launch-smoke
npm run mobile:store-readiness
npm run typecheck
npm run build
```

Then run the mobile app against your local API:

```powershell
npm run dev:api
npm run dev:mobile
```

Use `apps/mobile/.env` with a real LAN API URL, not `localhost`, when testing on a physical device.

## Manual device smoke matrix

Test at least:

- iOS simulator or iPhone through Expo Go / dev client
- Android emulator or Android phone through Expo Go / dev client
- small-screen device size
- dark mode and light mode
- English and French language settings
- logged-out state
- logged-in normal user
- two logged-in users for proposal flow

## First-launch visibility checks

With default first-launch flags:

- Bottom tabs show only `Trades`, `Needs`, `Offers`, `Account`.
- No Plans tab appears.
- No Wallet entry appears.
- No Payouts entry appears.
- No Add Money / Buy Credits entry appears.
- No Pro plan entry appears.
- No Business account entry appears.
- No ads appear in feed, detail, account, notifications, or conversations.
- No push notification permission prompt appears.
- No email notification preference UI appears.
- Store/demo copy does not promise wallet, payouts, paid helpers, Stripe, Airwallex, or subscriptions.

## Auth and account smoke

- Launch app logged out.
- Open Trades feed; public browsing loads or shows safe empty/loading/error state.
- Tap Needs, Offers, and Account while logged out; auth-required states are clear and do not mention wallet/payout beta tools.
- Register an 18+ account and accept required terms.
- Log out and log back in.
- Open Account.
- Open Profile.
- Open Settings.
- Open Security / 2FA page.
- Open Support.
- Open Account deletion request.
- Confirm Settings legal/safety links open.
- Confirm Account unread notification badge updates after notification-generating actions.

## Mobile reliability smoke

Before visual QA, test weak-network behavior:

- Turn on airplane mode, open Trades, then turn network back on and use retry/pull-to-refresh.
- Search/filter quickly in Trades; old results should not overwrite newer results.
- Open Notifications offline; an error state with a retry action should appear.
- Tap a notification multiple times; it should not send repeated mark-read requests.
- Open a proposal thread, type a private message, disconnect network, send, then reconnect and retry. The typed text should stay until a successful send.
- Double-tap Send / Accept / Decline / Withdraw / Save in proposal screens. Only one action should run.
- Create Need / Offer / Trade and double-tap Save/Publish. Only one create request should run.
- Upload images on slow network; uploads should have a longer timeout than normal JSON requests.
- While creating a Need or Offer with images, the form should show upload progress before the save finishes.
- Pick an unsupported or oversized image where possible; the picker should reject it before upload with clear copy.
- Start a Need/Offer/Trade/proposal draft, press Back, and confirm the unsaved-draft warning appears.
- Choose “Stay” in the discard warning; the draft should remain intact.
- Choose “Discard draft”; the screen should close without submitting.

## Trade feed and share smoke

- Feed/deck loads.
- Empty feed state is clear if there are no trades.
- Loading state is clear while fetching.
- API error state is clear and retryable.
- Trade card tap opens Trade Detail.
- Need/Offer image cards open Trade Detail.
- No share icon appears on feed cards.
- Share icon appears on Trade Detail header only.
- Native share sheet opens from Trade Detail.
- Shared text/link does not expose proposals, private messages, account data, admin data, or hidden Need/Offer data.

## Trade Detail smoke

- Trade Detail loads with clean social-detail layout.
- Need section appears before Offer section.
- Images render in the modern image grid.
- Metadata chips fit without horizontal overflow.
- Owner/public/applicant states are understandable.
- Report action is reachable where expected.
- Hidden or private trades are not exposed to unauthorized users.
- Proposal entry point appears only when the current user is allowed to propose.

## Need / Offer detail smoke

For a logged-in user:

- Create a Need.
- Try saving with a too-short title/description; field-level errors should appear and no request should be sent.
- Add images and confirm selected count, remove behavior, and save/upload progress.
- Open Need Detail.
- Confirm title, description, metadata, image grid, and bottom actions render cleanly.
- Edit Need.
- Add new images while editing and confirm upload progress appears during Save Changes.
- Make an edit, press Back, and confirm the unsaved-draft warning appears.
- Use Need in trade flow if available.
- Delete/close behavior still works as previously supported.
- Repeat the same checks for Offer Detail.
- Confirm another user cannot edit/delete your Need or Offer.

## Proposal/private thread smoke

Use two normal users.

Applicant:

- Open a Trade Detail.
- Try sending a proposal with fewer than 3 characters; a validation error should appear.
- Start typing a proposal, press Back, and confirm the unsaved-draft warning appears.
- Send a proposal.
- Open the private proposal thread.
- Confirm the mini trade summary strip is visible.
- Confirm proposal status block is visible.
- Confirm proposal package block is visible.
- Send a private message.
- Edit your own pending private message if supported.
- Delete your own pending private message if supported.
- Withdraw pending proposal if supported.

Owner:

- Open the proposal from Trade Detail or Notifications.
- Confirm private proposal content is visible only to owner/applicant.
- Accept a pending proposal.
- Decline a pending proposal.
- Send a private message.
- Edit/delete your own pending private message if supported.
- Confirm owner cannot edit/delete applicant proposal note.

After accepted/declined/withdrawn/cancelled:

- Locked states are clear.
- Composer disables when conversation is closed.
- Old messages do not expose edit/delete actions if no longer allowed.

## Notifications smoke

- Open Notifications from Account.
- Confirm dated grouping: Today / Yesterday / date.
- Confirm unread dot appears for unread notifications.
- Mark one notification as read by opening it.
- Mark all read if available.
- Confirm notification deep links go only to allowed destinations.
- Confirm private proposal notification preview does not expose message body beyond safe notification copy.
- Temporarily force a missing notification localization key in development; the row should show generic safe fallback copy, not raw backend title/body.
- Confirm empty state and API error state are clear.

## Mobile accessibility smoke

- On the register screen, screen readers announce Terms and 18+ rows as checkboxes and announce checked/unchecked state.
- Auth mode tabs announce selected state.
- Password show/hide announces a clear action label.
- Notification filter pills announce selected state and count.
- Notification rows announce safe title, read/unread state, and time, but not private message text.
- Shared bottom/detail action buttons announce disabled and loading/busy states.
- Proposal thread message option buttons announce “Message options” before opening the action sheet.
- Image picker Add/Remove buttons have clear labels and disabled state.
- Important icon-only buttons have at least 44px touch target or extra hitSlop.

## Privacy and safety boundaries

- Logged-out user cannot access proposal thread content.
- Logged-out auth-required copy does not mention wallet, payouts, or beta money tools when first-launch flags are off.
- Non-participant user cannot access private proposal messages.
- Trade owner sees proposal list; unrelated users do not.
- Applicant sees only their own proposal thread.
- Support tickets stay private to the ticket owner/admin.
- Admin notes, report details, moderation internals, and hidden/private content are not visible in mobile user screens.
- Suspended/restricted users cannot create Needs, Offers, Trades, or proposals if the API marks them restricted.

## Regression watch list

Stop and patch before launch if any of these happen:

- Wallet, payout, money trade, Pro, Plans, Business, ads, push, or email-notification UI appears with default first-launch flags.
- Share appears on feed cards.
- Proposal/private thread content is visible to a non-participant.
- Public Trade Detail exposes proposal messages.
- Need/Offer detail lets another user edit/delete someone else’s item.
- Trade Detail or Proposal Thread has horizontal overflow on a small device.
- App crashes when switching language, theme, auth state, or tabs.
- API errors expose raw stack traces or internal object IDs in user-facing copy.
- Screen readers announce unlabeled buttons such as “button” without useful context on auth, notifications, detail actions, or proposal thread screens.

## Store-readiness follow-up

Run `npm run mobile:store-readiness` and complete `docs/launch/mobile-store-readiness-checklist.md` before App Store / Google Play submission.

## Sign-off

Before moving past MOBILE-UI6, record:

- branch / commit
- API environment used
- test device(s)
- language(s)
- theme(s)
- users used for owner/applicant flows
- result of `npm run mobile:launch-smoke`
- result of `npm run mobile:store-readiness`
- result of `npm run typecheck`
- result of `npm run build`
- known issues and whether they are launch blockers
