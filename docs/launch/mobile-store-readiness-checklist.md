# MOBILE-QA4 — Store-readiness mobile checklist

Use this after `npm run mobile:launch-smoke` and before submitting a public mobile build to Apple App Store review, TestFlight external testing, Google Play closed testing, or Google Play production review.

Public-release scope stays strict:

```txt
No wallet, payouts, Cash Promise, paid helpers, Stripe, Airwallex, ads, push, or email notifications. Plans and offline Places are included in this release.
```

The app submitted to review should be described as an 18+ service/skill/need/offer exchange with public Trades and Plans, offline and online Places, private proposals, reporting, support, and moderation.

## Static commands

Run from the repository root:

```powershell
npm run mobile:launch-smoke
npm run mobile:app-review-smoke
npm run mobile:release-preflight
npm run store:copy-scan
npm run mobile:store-readiness
npm run typecheck
npm run build
```

Do not submit until all seven command lines pass locally. `npm run mobile:store-readiness` also runs the store-release guard, App Review static smoke, store-visible copy scan, focused UGC safety smoke, and Cash Promise store/safety checklist guard. Complete [the iPhone/iPad App Review smoke](./appstore26-ios-device-review-smoke.md) and [the mobile UGC safety review checklist](./mobile-ugc-safety-review-checklist.md) on the exact production build.

## App metadata

Follow [APPSTORE26-RELEASE1 — Production version and build runbook](./appstore26-production-release.md), then prepare or verify:

- App name: `Hellowhen`.
- Bundle ID: `com.hellowhen.app` or the final company-owned replacement.
- Android package: `com.hellowhen.app` or the final company-owned replacement.
- App icon and Android adaptive icon are production assets, not placeholders.
- Splash image is production-ready and not a dev/test logo.
- Marketing version is `1.0.0` for this replacement submission.
- EAS remote iOS build number is inspected before building and the resulting build is `26` or greater.
- Portrait-only behavior is intentional and has been tested.
- App category does not imply dating, payments, gambling, job placement, crypto, teen social, or financial services.
- Age rating is set for adults only / 18+ launch positioning.

## Reviewer account

Create and test a reviewer account before submission:

- Email: use a real account you can receive emails for.
- Password: temporary reviewer password, changed after review.
- User status: normal verified user, not admin.
- Seeded state: at least one Need, one Offer, one public Trade, one public Plan with mapped offline Places, one pending proposal from another test user, one support ticket, and one unread notification.
- Reviewer notes explain how to log in, where to find Plans / Me / Trade, and that money features are intentionally disabled.

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

## Apple Maps and offline Places

Verify on both an iPhone and an iPad review device:

- Opening an individual offline Place on iOS offers **Apple Maps** and **Google Maps**.
- Opening a Plan route on iOS offers **Apple Maps** and **Google Maps**.
- Apple Maps is listed first and opens through an `https://maps.apple.com` link.
- A single offline stop opens as a place search.
- A route with multiple offline stops labels Apple Maps as the first-stop option and opens directions from the current location to the first available mapped offline stop.
- The Google Maps option is labelled as the Plan route and keeps mapped offline stops in Plan order, up to the supported five-stop URL limit.
- Online Places are skipped by route navigation and continue to open as normal web links.
- Offline Places without coordinates or a usable public address are skipped and the route summary discloses how many were omitted.
- The route summary discloses when later mapped stops exceed the supported external-route limit.
- Every offline Place row still offers its own Apple Maps action, so reviewers can open any omitted or later stop separately when it has a mappable location.
- Test one-stop, two-stop, mixed online/offline, missing-address, and six-or-more-offline-stop Plans.
- Cancelling the provider dialog leaves the user inside Hellowhen.
- Failure to open either provider shows a localized error instead of silently doing nothing.

## Exact iPhone/iPad App Review pass

Before selecting the binary in App Store Connect:

- Run `npm run mobile:app-review-smoke`.
- Complete [APPSTORE26-QA1 — iPhone and iPad App Review smoke](./appstore26-ios-device-review-smoke.md).
- Test the exact EAS production binary, not Expo Go, a development client, or a preview build.
- Replay both rejected-build findings on a physical iPhone and iPad Air 11-inch compatibility presentation: no general Beta badge/copy and Apple Maps offered first alongside Google Maps.
- Record the EAS build ID, marketing version, build number, device/OS, language, appearance, and result in the private release evidence.
- Stop submission when the tested build differs from the binary selected in App Store Connect.

## User-generated content safety

Hellowhen includes user-generated content: profiles, Needs, Offers, Trades, public discussion messages, proposal messages, reports, support tickets, and images.

Verify before store submission:

- Trade Detail has a report flow for non-owners.
- Public profile has a report flow and block/unblock controls.
- Trade and Plan public discussion messages have report flows.
- Plan Detail and Plan Place detail have report flows for non-owners.
- Private proposal threads and private messages have report flows.
- Me → Safety center shows the reporter's private report history and blocked-member controls.
- Support Center lets users contact support, attach screenshots, and open Safety center.
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
- Location permission is requested only when the user explicitly starts offline Place presence verification, with the reviewed in-use explanation.
- No contacts permission is requested.
- No tracking permission is requested.
- No push SDK is installed.
- No mobile ads SDK is installed.
- No Stripe/Airwallex/payment SDK is installed.
- Cash Promise store/safety checklist passes and Cash Promise remains hidden for first launch.
- Store-visible copy scan passes with no Beta/Bêta, demo-feed, prototype, test-build, testing-flow, or unfinished pre-launch presentation in production source copy.

## Store listing assets

Prepare:

- App icon.
- Android adaptive icon.
- Feature graphic for Google Play.
- Screenshots showing: Plans feed or Plan Detail, Trade feed, Trade Detail, Create Need/Offer, Proposal thread, and Me/Safety.
- Short description.
- Long description.
- Support email/URL.
- Privacy Policy URL.
- Account deletion URL for Google Play.

Screenshot story should be:

```txt
Discover Plans and Trades → inspect an offline Place → create a Need/Offer → send a private proposal → manage safety and account settings.
```

Avoid screenshots that show hidden wallet, payouts, Cash Promise, paid plans, ads, admin UI, debug screens, mock money, or release-state badges.

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
- EAS production build ID / URL.
- iOS build number / Android version code.
- Device model(s), including the iPad compatibility-mode device used for iOS review smoke.
- OS version(s).
- Language(s): EN and FR.
- Theme(s): light, dark, system.
- Result of `npm run mobile:launch-smoke`.
- Result of `npm run mobile:app-review-smoke`.
- Result of `npm run store:copy-scan`.
- Result of `npm run mobile:store-readiness`.
- Result of `npm run typecheck`.
- Result of `npm run build`.
- Known issues and whether each one is a launch blocker.
