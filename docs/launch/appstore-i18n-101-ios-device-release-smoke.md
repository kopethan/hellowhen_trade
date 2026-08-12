# APPSTORE-I18N2 — Hellowhen 1.0.1 iOS exact-binary release smoke

Run this checklist on the exact TestFlight binary that will be selected for App Store Connect version 1.0.1. It complements the repository static smokes and preserves the successful APPSTORE26 rejection fixes as regression checks.

## Evidence record

| Field | Required value |
| --- | --- |
| App | Hellowhen |
| Bundle ID | com.hellowhen.app |
| Marketing version | 1.0.1 |
| iOS build number | 27 or greater |
| EAS build ID | Record exact ID |
| Commit SHA | Record exact SHA |
| API | https://api.hellowhen.com |
| Public web | https://www.hellowhen.com |
| Exact submitted binary | TestFlight production build selected for 1.0.1 |

Stop submission if any row refers to a different binary, commit, version, or build than the one selected in App Store Connect.

## Device matrix

At minimum test:

- a physical iPhone supported by the release;
- iPad Air 11-inch (M3) compatibility presentation, or the closest available device matching the prior App Review environment;
- light and dark appearance on at least one device;
- a fresh install and an upgrade path from the public 1.0.0 where practical.

The app remains `supportsTablet: false`; this is an iPhone app presented in iPad compatibility mode, not an iPad-native redesign.

## Native localization matrix

Record PASS/FAIL for each case on the exact production binary.

| Case | Expected result |
| --- | --- |
| French system language | Hellowhen UI resolves to French |
| English system language | Hellowhen UI resolves to English |
| Spanish system language | Hellowhen UI resolves to Spanish |
| Unsupported system language | Hellowhen falls back to French |
| Saved English preference | English remains selected after restart regardless of a supported non-English device language |
| Saved French preference | French remains selected after restart |
| Saved Spanish preference | Spanish remains selected after restart |
| Return preference to System | App follows supported device language again |

Also inspect the built app/native metadata and confirm the declared iOS localizations contain:

```txt
fr
en
es
```

and the development/fallback region is French (`fr`).

Do not treat the App Store Connect metadata localization as proof of binary localization; verify both independently.

## APPSTORE26 rejection regressions

These fixes were already accepted in public 1.0.0 and must not regress in 1.0.1:

- No Beta badge, generic Beta/Bêta presentation, demo-feed label, prototype label, or test-build messaging appears in normal production UI.
- On iOS, eligible offline Place actions offer Apple Maps.
- On iOS, eligible Plan route actions offer Apple Maps.
- Apple Maps is the first provider option and Google Maps remains optional.
- Cancelling the provider picker keeps the reviewer inside Hellowhen.

## Critical reviewer journey

On the exact TestFlight binary verify:

1. Fresh launch opens normally without debug/diagnostic UI.
2. Logged-out Me opens the real authentication flow.
3. Register/login/password-reset/legal-policy routes are reachable.
4. Plans and Trade navigation render normally with production flags.
5. Trade Detail opens public discussion and private proposal entry points as appropriate.
6. Reporting, block/unblock, Safety Center, Support Center, and account deletion remain reachable.
7. Photo-library permission text is production copy.
8. Location permission is requested only when the user explicitly starts offline Place presence verification.
9. Share/legal/account-deletion URLs resolve to production Hellowhen web pages.
10. No hidden wallet, payouts, Cash Promise, payment, subscription, ads, admin, or feature-diagnostics UI becomes visible.

## Upgrade check from 1.0.0

When a public 1.0.0 device is available, install/update to the candidate 1.0.1 build and verify:

- authentication/session state behaves normally;
- an explicit saved English/French/Spanish preference is not overwritten by the update;
- a user on `System` follows the supported device language;
- an unsupported system language uses French fallback;
- existing profile/trade/plan data remains available.

No database migration is expected for APPSTORE-I18N1/I18N2.

## Stop submission

Stop the 1.0.1 submission when any of these occur:

- marketing version is not 1.0.1;
- iOS build is lower than 27 or duplicates an existing App Store Connect build;
- the selected App Store Connect binary differs from the tested TestFlight binary;
- English/French/Spanish system-language behavior is wrong;
- an unsupported system language falls back to English instead of French;
- a saved explicit language is overwritten;
- native iOS localization metadata does not declare `fr`, `en`, and `es` with French development region;
- either APPSTORE26 rejection regression returns;
- a critical auth/safety/legal route fails;
- hidden first-launch features become visible.

Record the final result in the private 1.0.1 evidence file before final App Review submission.
