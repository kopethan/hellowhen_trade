# MOBILE-QA4 — Store-readiness mobile checklist

Use this after `npm run mobile:launch-smoke` and before submitting any first-launch mobile build to Apple App Store review, TestFlight external testing, Google Play closed testing, or Google Play production review.

First-launch scope stays strict:

```txt
No wallet, payouts, Cash Promise, paid helpers, Stripe, Airwallex, ads, push, email notifications, or Plans.
```

The app submitted to review should be described as an 18+ service/skill/need/offer exchange with public trades, private proposals, reporting, support, and moderation.

## Static commands

Run from the repository root:

```powershell
npm run mobile:launch-smoke
npm run mobile:store-readiness
npm run typecheck
npm run build
```

Do not submit until all four pass locally. `npm run mobile:store-readiness` also runs the Cash Promise store/safety checklist guard.

## App metadata

Prepare or verify:

- App name: `Hellowhen`.
- Bundle ID: `com.hellowhen.app` or the final company-owned replacement.
- Android package: `com.hellowhen.app` or the final company-owned replacement.
- App icon and Android adaptive icon are production assets, not placeholders.
- Splash image is production-ready and not a dev/test logo.
- Version is incremented before each store upload.
- Portrait-only behavior is intentional and has been tested.
- App category does not imply dating, payments, gambling, job placement, crypto, teen social, or financial services.
- Age rating is set for adults only / 18+ launch positioning.

## Reviewer account

Create and test a reviewer account before submission:

- Email: use a real account you can receive emails for.
- Password: temporary reviewer password, changed after review.
- User status: normal verified user, not admin.
- Seeded state: at least one Need, one Offer, one public Trade, one pending proposal from another test user, one support ticket, and one unread notification.
- Reviewer notes explain how to log in, where to find Trades / Needs / Offers / Account, and that money features are intentionally disabled.

Do not give reviewers an admin account unless they explicitly ask for admin review access.

## Account deletion

Verify in the submitted build:

- Account → Settings & safety → Delete account is reachable after login.
- The screen explains what happens to profile/content/safety/support records.
- The user can request deletion in the app.
- The user can cancel an active deletion request when the backend supports it.
- The flow links to Support for privacy/account questions.
- A public web deletion request URL exists before Google Play production submission.
- Privacy policy explains retained data, especially safety, fraud, support, report, and audit records.

## Legal and policy links

Verify these are reachable in-app:

- Register screen: Terms link.
- Register screen: Privacy Policy link.
- Settings: full legal, privacy, and safety center.
- Support: Safety Guidelines.
- Support: Refund & Dispute Policy.
- Account deletion: Support link.

Before public review, final URLs must also exist on the public web app for:

- Terms.
- Privacy Policy.
- Community & Safety Guidelines.
- Support / Contact.
- Account deletion request.
- Report content / safety contact, if separate.

## User-generated content safety

Hellowhen includes user-generated content: profiles, Needs, Offers, Trades, public discussion messages, proposal messages, reports, support tickets, and images.

Verify before store submission:

- Trade Detail has a report flow for non-owners.
- Public profile has a report flow.
- Public discussion messages have a report flow.
- Support Center lets users contact support and attach screenshots.
- Admin moderation queue is operational on the production backend.
- Admin can hide/restore content, restrict/suspend users, review reports, and keep audit notes.
- Private proposal messages are not public discovery content.
- Notification previews do not reveal private message text, report details, or admin notes.

## Data safety / privacy disclosures

Prepare answers for Google Play Data safety and Apple App privacy before submission.

Expected first-launch data categories to review:

- Account email.
- Display name, handle, avatar, bio, country, language, appearance, and currency preference.
- Public content: Trades, Needs, Offers, profile content, and media.
- Private content: proposal messages, support tickets, report details, screenshots, and admin moderation data.
- Authentication/session data.
- Safety/restriction/report/audit records.
- Diagnostics if any logging or crash reporting is added later.

Do not declare ads, tracking, push tokens, payment data, wallet balances, Stripe, Airwallex, payouts, or subscription data for the first launch unless a separate patch actually enables those features.

## Permissions and SDKs

The first mobile launch should only request photo-library access because users can choose images for profile, Needs, Offers, trade references, support screenshots, and reports.

Before submission, verify:

- iOS photo-library permission text is present and explains selected-photo use.
- No camera permission is requested.
- No microphone permission is requested.
- No location permission is requested.
- No contacts permission is requested.
- No tracking permission is requested.
- No push SDK is installed.
- No mobile ads SDK is installed.
- No Stripe/Airwallex/payment SDK is installed.
- Cash Promise store/safety checklist passes and Cash Promise remains hidden for first launch.

## Store listing assets

Prepare:

- App icon.
- Android adaptive icon.
- Feature graphic for Google Play.
- Screenshots showing: Trades feed, Trade Detail, Create Need, Create Offer, Proposal thread, Account/Safety.
- Short description.
- Long description.
- Support email/URL.
- Privacy Policy URL.
- Account deletion URL for Google Play.

Screenshot story should be:

```txt
Discover useful trades → create a Need → create an Offer → send a private proposal → manage account/support safely.
```

Avoid screenshots that show hidden wallet, payouts, Cash Promise, Pro plans, Plans, ads, admin UI, debug screens, or mock money.

## Review notes template

Use a note like this and adapt it to the final test account:

```txt
Hellowhen is an 18+ service/skill/need/offer exchange.
Money features are intentionally disabled for the first launch: no wallet, no payouts, no paid helpers, no Stripe/Airwallex, no subscriptions, no ads, no push notifications, and no email notifications.

Reviewer login:
Email: <reviewer email>
Password: <temporary password>

Suggested review path:
1. Open Trades and view a public Trade Detail.
2. Open Needs and Offers to see owner-managed listings.
3. Send or review a private proposal thread using the prepared test trade.
4. Open Account → Legal/Safety, Support, Notifications, Settings, and Delete account.
5. Use report buttons on non-owned Trade/Profile/Public Message examples.
```

## Manual device sign-off

Record before submission:

- Commit SHA.
- API environment.
- Web URL used for share/legal/account deletion links.
- iOS build number / Android version code.
- Device model(s).
- OS version(s).
- Language(s): EN and FR.
- Theme(s): light, dark, system.
- Result of `npm run mobile:launch-smoke`.
- Result of `npm run mobile:store-readiness`.
- Result of `npm run typecheck`.
- Result of `npm run build`.
- Known issues and whether each one is a launch blocker.
