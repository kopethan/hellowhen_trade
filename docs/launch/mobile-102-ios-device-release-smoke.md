# Hellowhen 1.0.2 iOS exact-binary release smoke

Run this checklist on the exact TestFlight production binary intended for App Store Connect version 1.0.2.

## Evidence record

| Field | Required value |
| --- | --- |
| App | Hellowhen |
| Bundle ID | com.hellowhen.app |
| Marketing version | 1.0.2 |
| iOS build number | 28 or greater |
| EAS build ID | Record exact ID |
| Commit SHA | Record exact SHA |
| API | https://api.hellowhen.com |
| Public web | https://www.hellowhen.com |
| Exact submitted binary | TestFlight production build selected for 1.0.2 |

Stop if any row refers to a different binary, commit, version, or build than the one selected in App Store Connect.

## Required device checks

Test at minimum on a supported physical iPhone and the closest available iPad compatibility presentation used for prior review regression checks.

Replay the historical APPSTORE26 rejection regressions on the iPad Air 11-inch (M3) compatibility presentation when available, or the closest equivalent. Confirm **No Beta badge** or general Beta/testing copy is visible, and eligible Place/Plan map actions still offer Apple Maps first, with Google Maps optional where applicable.

Verify:

1. Fresh launch opens without debug/diagnostic UI.
2. Plans | Me | Trade remains the production primary navigation.
3. Login/register/reset/legal flows work normally.
4. Plans, Trades, Needs, Offers, proposals, reports, block/unblock, Support, Safety Center, and account deletion remain reachable as intended.
5. Light, Dark, and System appearance persist after restart.
6. French, English, and Spanish language behavior remains correct; unsupported system languages fall back to French.
7. Eligible iOS map actions continue to offer Apple Maps.
8. No hidden wallet, payout, Cash Promise, payment, subscription, ads, admin, or diagnostics UI is exposed.
9. The bundled app-update light/dark artwork renders correctly when the update prompt is exercised in a controlled non-production policy test.
10. Optional update mode shows Later + Update; mandatory mode shows Update only; policy/network failures remain fail-open.
11. With production policy disabled, normal launch shows no update prompt.

## Upgrade check from public 1.0.1

When a public 1.0.1 device is available, update to the candidate 1.0.2 binary and verify session state, saved language/appearance preferences, existing user content, and navigation remain intact.

## Stop submission

Stop the 1.0.2 submission when:

- marketing version is not 1.0.2;
- iOS build is lower than 28 or duplicates an existing App Store Connect build;
- selected App Store Connect binary differs from the tested TestFlight binary;
- a critical auth/safety/legal route fails;
- a prior App Review regression returns;
- a hidden first-launch feature becomes visible;
- update-policy behavior can incorrectly block launch while policy is disabled or unreachable.
