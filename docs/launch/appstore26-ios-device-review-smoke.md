# APPSTORE26-QA1 — iPhone and iPad App Review smoke

Use this checklist on the exact iOS production build that will be submitted to App Store Connect. This is the manual device pass that complements the static checks in `npm run mobile:app-review-smoke`.

## Non-negotiable test rule

**Exact submitted binary:** sign off only from the EAS production `.ipa`/TestFlight build with the same marketing version, build number, commit, API URL, and production feature flags that will be sent to App Review.

Do not sign off from:

- Expo Go;
- a development client;
- Metro with local environment overrides;
- a preview build with different flags;
- an older TestFlight build;
- a simulator-only pass.

## Required device matrix

Run the full rejection-regression path on both rows and the broader journey on at least one physical iPhone.

| Device | Required mode | Required checks |
| --- | --- | --- |
| Current physical iPhone | portrait, light and dark | full reviewer journey, permissions, external Maps launch, weak network, relaunch |
| iPad Air 11-inch (M3) or equivalent | iPhone compatibility mode, portrait | build 25 rejection regression, layout clipping, provider dialog, legal/support/account screens |
| Small-screen iPhone or simulator | portrait | text wrapping, keyboard, bottom actions, long French labels |

The rejected build was reviewed on an **iPad Air 11-inch (M3)**. Keep `supportsTablet: false` for this release unless a separate full iPad-native redesign and QA pass is completed. The expected result is a usable iPhone compatibility presentation, not an iPad-native layout.

## Before installing

Record the production values before testing:

- commit SHA;
- EAS production build URL or build ID;
- marketing version;
- iOS build number;
- production API URL;
- public web URL used for legal/support pages;
- reviewer account email stored in the private release record;
- second-member test account email stored in the private release record.

Run from the repository root:

```powershell
npm run mobile:app-review-smoke
npm run mobile:release-preflight
npm run mobile:store-readiness
npm run typecheck
npm run build
```

All commands must pass before device sign-off. The static App Review smoke does not replace this manual test.

## Clean-install baseline

1. Delete Hellowhen from the device.
2. Restart the device if an older build had permission or deep-link problems.
3. Install the exact production build.
4. Launch while logged out.
5. Confirm there is no dev menu, debug overlay, flag diagnostics, mock/demo inventory, or placeholder error copy.
6. Confirm no permission prompt appears automatically at launch.
7. Confirm the first screen renders without clipping, blank overlays, or an infinite loading state.
8. Background the app, return to it, then force-close and relaunch.
9. Confirm language, appearance, and authentication state restore as expected.

## Build 25 rejection regression

Complete this section on both the physical iPhone and the iPad Air 11-inch (M3) compatibility presentation.

### Production presentation

- Open **Me** while logged out and confirm the login/register screen appears directly.
- Log in with the reviewer account and reopen **Me**.
- **No Beta badge** appears in the Me header or profile area.
- No visible screen, menu, loading state, legal overview, support copy, or empty state describes the submitted app as beta, demo, prototype, test build, or unfinished.
- Open Terms, Privacy Policy, Safety Guidelines, Refund & Dispute Policy, Support, and Delete account; confirm each uses current production wording.
- Open the public web legal/support links from the build and confirm the public website does not present the production service as beta.

### Apple Maps parity

Prepare a public Plan owned by the second-member account with:

- one valid offline Place;
- at least two valid offline Places in order;
- one online Place between offline Places;
- one offline Place without a usable address/coordinates;
- six or more mapped offline Places for the route-limit case.

Verify:

1. Open an individual offline Place.
2. Tap its map/address action.
3. Confirm the iOS provider dialog lists **Apple Maps first**, then Google Maps, then Cancel.
4. Choose Apple Maps and confirm the native Apple Maps app opens to the intended Place.
5. Return to Hellowhen and repeat with Google Maps.
6. Reopen the dialog and tap Cancel; confirm the user stays in Hellowhen.
7. Open the Plan route action.
8. For one offline stop, confirm Apple Maps opens a Place search.
9. For multiple offline stops, confirm Apple Maps is labelled as the first-stop route and opens directions to the first mapped offline stop.
10. Confirm Google Maps is labelled as the Plan route and preserves included offline stops in Plan order.
11. Confirm online Places are excluded from external directions.
12. Confirm the route summary discloses skipped offline Places with no mappable location.
13. Confirm the route summary discloses mapped stops omitted beyond the supported route limit.
14. Confirm every eligible offline Place can still be opened individually in Apple Maps.
15. Temporarily make a provider unavailable or use a malformed test location in a non-production test account; confirm Hellowhen shows a localized error instead of failing silently.

Stop submission if Apple Maps is missing from either the individual Place action or the Plan route action.

## Reviewer journey

Use the same normal, non-admin reviewer account described in App Store Connect notes.

### Logged out

- Plans feed opens publicly.
- Trade feed opens publicly.
- Trade Detail opens publicly.
- Plan Detail opens publicly.
- Me opens authentication directly.
- Auth-required actions explain that login is needed without exposing hidden features.
- Terms and Privacy links open from registration.
- No private proposal or account content can be reached by back navigation or deep links.

### Logged in

- Plans, Me, and Trade tabs are present in the expected order and remain tappable on iPhone and iPad compatibility mode.
- Me header, profile summary, expandable sections, counters, and overflow menu fit without horizontal clipping.
- Notifications opens and safe unread copy is visible.
- Settings opens.
- Safety Center opens.
- Support Center opens and can create a test ticket.
- Account deletion opens, can create a request, and can cancel the pending request before processing.
- Legal and safety policies are reachable without a dead link.
- Log out succeeds and returns Me to the auth screen.

### Trade and proposal path

- Open a public Trade Detail.
- Confirm Need appears before Offer.
- Confirm images, metadata, share, public discussion, and proposal entry fit on the small-screen device.
- Send or open the prepared private proposal.
- Confirm only the owner and applicant can see the private thread.
- Send a private message.
- Confirm notification previews do not reveal raw private message text.
- Report a Trade, public message, proposal, and private message using harmless test content.
- Confirm report success does not reveal admin notes, moderation case IDs, or internal account fields.

### Plan and Place path

- Open a public Plan.
- Open Plan public discussion.
- Open an online Place and confirm it opens as a web link rather than entering external route navigation.
- Open an offline Place and exercise Apple Maps parity.
- Start location verification only from the explicit **Verify I'm here** action.
- Deny location permission and confirm the app remains usable with clear recovery copy.
- Grant location permission and confirm no background-location permission is requested.

## iPad compatibility layout pass

On iPad Air 11-inch (M3) or equivalent in iPhone compatibility mode, inspect every screen below at the top, middle, and bottom of its scroll range:

- logged-out Me/auth;
- logged-in Me;
- Plans feed and Plan Detail;
- offline Place detail and map-provider dialog;
- Trade feed and Trade Detail;
- public discussion;
- private proposal thread and keyboard composer;
- Notifications;
- Settings;
- Safety Center;
- Support Center;
- Legal Policy;
- Account deletion.

Confirm:

- no title, badge, button, dialog, or bottom action is clipped;
- the keyboard does not cover the active input or Send/Save action;
- bottom navigation remains above the home indicator;
- action sheets are readable and dismissible;
- pull-to-refresh works where provided;
- scrolling does not freeze or close the app;
- rotating the iPad does not expose a broken landscape layout; the app remains in its declared portrait presentation;
- returning from Apple Maps restores the same Hellowhen screen without losing navigation state.

## Language and appearance matrix

Run the rejection-regression path in:

- English, light;
- English, dark;
- French, light;
- French, dark.

On the small-screen device, also check French text wrapping for:

- map-provider labels;
- multi-stop route summary;
- Me menu rows;
- Safety Center actions;
- account deletion actions;
- authentication Terms/18+ rows.

Changing language or appearance must not crash the app, reset authentication, or restore removed release-state wording.

## Permissions and privacy prompts

From a clean install:

- no tracking prompt appears;
- no camera prompt appears;
- no microphone prompt appears;
- no contacts prompt appears;
- no push-notification prompt appears;
- photo-library permission appears only after an explicit image-selection action;
- location permission appears only after **Verify I'm here** on an offline Place;
- denying either optional permission keeps the rest of the app usable;
- permission copy matches the purpose shown to the user.

## Network and interruption pass

Test on Wi-Fi, cellular, and a temporarily offline state:

- launch logged out and logged in;
- load Plans and Trades;
- open Plan/Trade Detail;
- open Notifications;
- submit a private message;
- create a support ticket;
- return from Apple Maps;
- background and resume during a load.

Confirm errors are localized, retryable, and do not expose stack traces, raw API objects, private IDs, or demo fallback content.

## Stop submission

Do not upload or resubmit when any of these occurs:

- any visible Beta/demo/prototype/test-build presentation returns;
- Apple Maps is absent from an eligible iOS Place or Plan route action;
- Google Maps is the only provider shown on iOS;
- the iPad compatibility presentation clips primary controls or blocks navigation;
- the production build points to localhost, staging, or a non-production API/web URL;
- hidden wallet, payout, Cash Promise, ads, subscriptions, diagnostics, or experimental tools appear;
- a logged-out or unrelated user can see private proposal content;
- a required legal, support, reporting, blocking, or deletion path is unavailable;
- the app crashes or becomes unresponsive during the reviewer journey;
- the tested build number differs from the binary selected in App Store Connect.

## Evidence record

Copy `docs/launch/appstore26-submission-evidence-template.md` to `.release-private/appstore26-submission-evidence.md` and store the completed record privately with the release. Do not commit credentials or reusable passwords.

| Field | Value |
| --- | --- |
| Commit SHA | |
| EAS build ID / URL | |
| Marketing version | 1.0.0 |
| iOS build number | 26 or greater |
| App Store Connect submission ID | |
| API URL | |
| Public web URL | |
| Physical iPhone model / iOS | |
| iPad model / iPadOS / compatibility mode | |
| Small-screen device / simulator | |
| EN light result | |
| EN dark result | |
| FR light result | |
| FR dark result | |
| Build 25 rejection regression | |
| Apple Maps individual Place | |
| Apple Maps Plan route | |
| UGC safety checklist | |
| Account deletion | |
| Weak-network pass | |
| `mobile:app-review-smoke` | |
| `mobile:release-preflight` | |
| `mobile:submission-preflight` | |
| `mobile:store-readiness` | |
| `typecheck` | |
| `build` | |
| Known non-blocking issues | |
| Final tester / date | |

The release owner should sign off only after every stop-submission condition is clear and the evidence references the exact binary selected for App Review.
