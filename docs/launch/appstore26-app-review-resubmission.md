# APPSTORE26-SUBMIT1 — App Review notes and resubmission checklist

Use this checklist only after the APPSTORE26 fix chain is applied, the replacement production build is uploaded, and the exact TestFlight binary passes the device checklists.

## Rejection being resolved

```txt
App: Hellowhen
Original submission ID: 46ed2c97-069c-4c92-a903-3c82d1b690de
Original version/build: 0.1.0 (25)
Review date: August 5, 2026
Review device: iPad Air 11-inch (M3)
Replacement marketing version: 1.0.0
Replacement iOS build: 26 or greater
```

Apple identified two unresolved items:

1. **Guideline 2.2 — Performance — Beta Testing**: the production app displayed a general `BETA` badge and related release-state wording.
2. **Guideline 4 — Design**: location actions did not offer the native Apple Maps app.

This submission should answer only those findings clearly and factually. Do not argue that the earlier build should have passed, describe unfinished future work, or introduce unrelated product concepts in the review response.

## 1. Required green checks before App Store Connect

From the repository root:

```powershell
npm ci
npm run mobile:submission-preflight
npm run mobile:store-readiness
npm run typecheck
npm run build
```

Then complete on the exact TestFlight build:

```txt
docs/launch/appstore26-ios-device-review-smoke.md
docs/launch/mobile-ugc-safety-review-checklist.md
```

Stop when any command fails, any manual checklist item fails, the exact tested binary cannot be identified, or the selected App Store Connect build differs from the TestFlight build that passed QA.

## 2. Prepare the reviewer account privately

Create or verify a normal production reviewer account. Store the credentials only in App Store Connect and the private release record—not in Git, screenshots, tickets, or shared chat.

The account should:

- sign in without an invitation, one-time code, or approval from another person;
- have accepted the current Terms, Privacy Policy, and 18+ confirmation;
- have no suspended/restricted state;
- open **Plans**, **Me**, and **Trade** normally;
- have access to the prepared review content below.

Prepare review content owned by a second account so report/block and proposal flows remain available:

- one public Trade;
- one public Plan containing at least two mapped offline Places in order;
- one online Place between the offline Places;
- one public discussion message;
- one private proposal thread available to the reviewer account.

For the Apple Maps regression path, ensure the first offline Place has a stable public address or coordinates. Do not delete or rename the prepared Plan after recording the review notes.

## 3. Verify the App Store version and exact build

In App Store Connect:

1. Open **Apps → Hellowhen**.
2. Open the iOS app version for **1.0.0**.
3. In **Build**, select the exact processed build that passed TestFlight QA.
4. Confirm the displayed build number is **26 or greater**.
5. Confirm the build upload time and version match the private release evidence.
6. Resolve any **Missing Compliance** state before continuing.
7. Save the version.

Do not select build 25. Do not select a later build that has not completed the same device QA.

## 4. App Review Information fields

Complete the App Review Information section with current, reachable details:

```txt
Contact first name: <REVIEW_CONTACT_FIRST_NAME>
Contact last name: <REVIEW_CONTACT_LAST_NAME>
Contact phone: <REVIEW_CONTACT_PHONE>
Contact email: <REVIEW_CONTACT_EMAIL>
Sign-in required: Yes
Reviewer username/email: <REVIEWER_EMAIL>
Reviewer password: <TEMPORARY_PASSWORD>
```

Before saving:

- test the credentials in a clean install of the exact build;
- verify capitalization and spaces in the password;
- keep the account active until review is complete;
- do not require Apple to register a new account;
- do not rotate the password after submission unless Apple asks.

## 5. App Review Information — Notes template

Replace every angle-bracket placeholder before pasting. Keep the note in English so it matches the original review message.

```txt
Hellowhen is a production app for adults to discover and create Plans and service/skill/need/offer exchanges. The submitted release does not process payments and does not include subscriptions, ads, a wallet, or payouts.

This build resolves both findings from submission 46ed2c97-069c-4c92-a903-3c82d1b690de:

Guideline 2.2 — Performance — Beta Testing
- Removed the general BETA badge shown on the Me screen in the review screenshot.
- Removed beta/demo/prototype/test-build presentation from the production native app and linked public web/legal pages.
- The replacement is presented as the public production release.

Guideline 4 — Design
- Added Apple Maps as the first map-provider option on iOS for eligible offline Places and Plan route actions.
- Google Maps remains an optional alternative.
- For a Plan with multiple offline stops, Apple Maps opens directions to the first mapped offline stop; each mapped Place can also be opened individually in Apple Maps. Google Maps can open the ordered multi-stop Plan route.

Reviewer account:
Email: <REVIEWER_EMAIL>
Password: <TEMPORARY_PASSWORD>

Suggested verification path:
1. Sign in with the reviewer account.
2. Open Me and confirm there is no BETA badge or general beta-testing presentation.
3. Open Plans.
4. Open the prepared public Plan named “<REVIEW_PLAN_TITLE>”.
5. Open an offline Place and tap its map/address action.
6. Confirm Apple Maps is the first option, choose it, and verify Apple Maps opens the Place.
7. Return to Hellowhen, open the Plan route action, and choose Apple Maps.
8. Google Maps remains available as an optional second provider.

Privacy Policy: https://hellowhen.com/legal/privacy
Support: https://hellowhen.com/support
```

Do not claim that Apple Maps provides the complete multi-stop route. The reviewed implementation deliberately labels the Apple Maps action as the first-stop route and keeps the full ordered multi-stop option under Google Maps.

## 6. Reply to the unresolved App Review message

Use **Reply to App Review** on the unresolved submission and paste this shorter response after the replacement build has been selected:

```txt
Hello App Review,

Thank you for the review. We addressed both issues in Hellowhen version 1.0.0, build <IOS_BUILD_NUMBER>.

For Guideline 2.2, we removed the general BETA badge shown in the attached screenshot and removed beta/testing presentation from the production app and linked public pages.

For Guideline 4, we added Apple Maps as the first option on iOS when opening eligible offline Places and Plan route actions. Google Maps remains available as an optional alternative.

Verification path:
1. Sign in with the reviewer account in App Review Information.
2. Open Plans and select “<REVIEW_PLAN_TITLE>”.
3. Tap an offline Place map/address action or the Plan route action.
4. Select Apple Maps.

The exact replacement build and credentials are included in App Review Information.

Thank you.
```

Replace `<IOS_BUILD_NUMBER>` and `<REVIEW_PLAN_TITLE>` before sending. Do not send this response while build 25 is still selected.

## 7. Store metadata final check

Before adding the version for review:

- version name is `1.0.0`;
- selected build is the exact tested build `26` or greater;
- privacy policy URL is `https://hellowhen.com/legal/privacy`;
- support URL is reachable without authentication;
- screenshots and descriptions contain no general Beta/demo/prototype/test-build presentation;
- screenshots show only enabled production features;
- App Privacy answers match the current binary and backend behavior;
- age rating and availability are complete;
- export-compliance questions are resolved;
- no in-app purchase or subscription item is attached to this submission;
- review credentials work from a clean install;
- the prepared Plan and Places still exist.

Suggested **What’s New** text for version 1.0.0:

```txt
Welcome to Hellowhen. Discover Plans and Trades, create Needs and Offers, use safer reporting and support tools, and open offline Places with your preferred maps app.
```

## 8. Add and resubmit the corrected version

Because the existing submission has unresolved issues, first open **View App Review Issues & Messages**, open the submission, and choose **Resolve**.

Then use the path App Store Connect allows for the replacement marketing version:

### Path A — the rejected app item can be edited to version 1.0.0

1. Choose **Edit** for the rejected iOS app item.
2. Confirm version `1.0.0` and the exact tested replacement build are selected.
3. Save all metadata and App Review Information.
4. Choose **Add for Review** for the corrected item.
5. Return to the submission and choose **Resubmit to App Review** when every item is ready.

### Path B — the rejected item remains locked to version 0.1.0

Do not try to attach a `1.0.0` build to a `0.1.0` version record.

1. Remove the rejected `0.1.0` app item from the unresolved submission.
2. Open or create the iOS version record for `1.0.0`.
3. Select the exact tested `1.0.0` build, complete metadata and App Review Information, and save.
4. Choose **Add for Review** for version `1.0.0`.
5. Add it to the available draft submission or create the replacement submission offered by App Store Connect.
6. Choose **Submit/Resubmit to App Review** only after confirming the selected build is the exact tested binary.

Button labels can vary slightly with App Store Connect localization. The important rules are: version and build must match, build 25 must not be selected, and the corrected `1.0.0` item must be included in the submission sent to review.

## 9. Private evidence record

Copy the blank template before filling it:

```powershell
New-Item -ItemType Directory -Force .release-private | Out-Null
Copy-Item docs/launch/appstore26-submission-evidence-template.md .release-private/appstore26-submission-evidence.md
```

`.release-private/` is ignored by Git. Record the exact EAS build ID, TestFlight build, device checks, reviewer account identifier, App Store Connect selection, reply timestamp, and final submission status there.

Never add the completed private evidence file to the repository.

## 10. Stop-submission conditions

Do not resubmit when any of these is true:

- the selected build is 25 or is not the exact build tested through TestFlight;
- the Me screen still displays a general release-state badge;
- a public native or linked web page still presents Hellowhen as beta/demo/prototype/test-build content;
- Apple Maps is absent from an eligible Place or Plan route action;
- Apple Maps is not the first provider shown on iOS;
- reviewer credentials fail or require a one-time code;
- the prepared Plan/Place route cannot be opened;
- a required policy/support URL fails;
- a store-readiness, typecheck, build, or manual-device check fails;
- unresolved crash, blank screen, permission, navigation, or account-deletion issues remain.

After resubmission, keep the reviewer account and prepared content unchanged until Apple finishes the review.
