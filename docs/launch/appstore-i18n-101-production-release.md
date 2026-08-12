# APPSTORE-I18N2 — Hellowhen 1.0.1 production release runbook

Use this runbook for the normal App Store update that follows the already released Hellowhen 1.0.0. The historical APPSTORE26 rejection/resubmission documents stay unchanged as evidence and regression context; this document is the active release path for 1.0.1.

## Release identity

```txt
App: Hellowhen
Bundle ID: com.hellowhen.app
App Store Connect app ID: 6781399122
Previous public version: 1.0.0
Marketing version: 1.0.1
Minimum iOS build: 27
EAS profile: production
API: https://api.hellowhen.com
Public web: https://www.hellowhen.com
```

`apps/mobile/app.json` controls the marketing version. The developer-facing iOS build number remains managed remotely by EAS because `cli.appVersionSource` is `remote` and the production profile has `autoIncrement: true`.

Do not add a local `ios.buildNumber` only to force build 27. The remote EAS value and the latest build already issued in App Store Connect must be checked first.

## 1. Freeze the release commit

From the repository root:

```powershell
git status --short
git rev-parse HEAD
npm ci
npm run mobile:release-preflight
npm run mobile:submission-preflight
npm run mobile:store-readiness
npm run typecheck
npm run build
```

Stop when:

- the worktree contains an unexpected source change;
- any required command fails;
- the marketing version is not `1.0.1`;
- the production API/public web URL differs from the release values above;
- a store-hidden money, wallet, payout, Cash Promise, ads, subscription, or diagnostics feature is unintentionally visible.

Record the commit SHA. Device sign-off and the App Store Connect build selection must refer to a binary built from that same commit.

## 2. Inspect the remote iOS build number

From `apps/mobile`:

```powershell
cd apps/mobile
eas login
eas build:version:get --platform ios --profile production
```

Compare the returned value with the latest iOS build already issued in App Store Connect.

- If the latest issued build is `26`, keep the remote value at `26`; production auto-increment should create build `27`.
- If the latest issued build is already greater than `26`, keep that newer sequence and let production auto-increment create the next unused build.
- If the EAS remote value is missing or lower than the latest build in App Store Connect, reconcile it before building.

**Do not run `eas build:version:set` blindly.** Never reset the remote source to `26` or `27` simply because this runbook says the minimum new build is 27. Use `version:set` only after comparing EAS with App Store Connect, and set the latest developer-facing build number already issued, not the number you hope to create.

If reconciliation is actually required:

```powershell
eas build:version:set --platform ios --profile production
eas build:version:get --platform ios --profile production
```

## 3. Create the production 1.0.1 binary

APPSTORE-I18N1 changed native iOS localization metadata, so use a clean production build for the first 1.0.1 candidate:

```powershell
eas build --platform ios --profile production --clear-cache
```

Do not use `--auto-submit`. Record the completed production binary first, then upload that exact build deliberately for TestFlight/device QA.

Record:

- EAS build ID and URL;
- commit SHA;
- marketing version (`1.0.1`);
- generated iOS build number;
- production API and web URLs;
- completion time.

The generated iOS build number must be `27` or greater and must not duplicate a build already present in App Store Connect.

## 4. Upload the exact build deliberately

After the build completes and static release checks remain green:

```powershell
eas submit --platform ios --profile production
```

Prefer selecting the exact recorded EAS build. To avoid ambiguity:

```powershell
eas submit --platform ios --profile production --id <EAS_BUILD_ID>
```

The submit profile targets App Store Connect app `6781399122`. Uploading the binary is not the same as sending version 1.0.1 to App Review.

Never commit Apple credentials, app-specific passwords, API private keys, reviewer passwords, or reusable sessions.

## 5. Test the exact TestFlight binary

Complete:

```txt
docs/launch/appstore-i18n-101-ios-device-release-smoke.md
docs/launch/mobile-ugc-safety-review-checklist.md
```

The 1.0.1 device pass must include:

- French device/system language → French UI;
- English device/system language → English UI;
- Spanish device/system language → Spanish UI;
- unsupported device/system language → French fallback;
- explicit saved English/French/Spanish preferences remain respected after restart;
- native iOS language declarations show French, English, and Spanish in the built app metadata;
- APPSTORE26 rejection regressions remain fixed: no general Beta presentation and Apple Maps remains offered first for eligible iOS Place/Plan map actions;
- iPhone and iPad compatibility-mode presentation remain usable;
- critical UGC safety/report/block/support flows remain available.

Do not sign off from Expo Go, a development client, a preview profile, or a different TestFlight build.

## 6. Prepare App Store Connect version 1.0.1

The existing public 1.0.0 remains the live version while this update is prepared/reviewed. In App Store Connect, prepare the update under the same Hellowhen app record and select the exact tested 1.0.1 build.

Before final submission, verify:

- French localization remains present;
- English (U.S.) localization is added with the approved 1.0.1 metadata and screenshots;
- support/privacy URLs still point to production Hellowhen pages;
- privacy policy URL is `https://hellowhen.com/legal/privacy`;
- screenshots and copy describe only features present in the submitted repository/build;
- no hidden payment, wallet, Cash Promise, subscriptions, ads, admin, debug, or prototype UI appears in store assets.

APPSTORE-I18N3 is now the active metadata/review package:

```txt
docs/launch/appstore-i18n-101-english-localization.md
docs/launch/appstore-i18n-101-en-US-metadata.json
```

Use those files for the exact English (U.S.) metadata, What's New text, App Review Notes, screenshot order, shared URLs, and final localization checklist. Do not improvise or reuse the old APPSTORE26 rejection reply as the 1.0.1 review note.

## 7. Keep release evidence private

Copy the blank evidence template into the ignored private directory:

```powershell
New-Item -ItemType Directory -Force .release-private | Out-Null
Copy-Item docs/launch/appstore-i18n-101-submission-evidence-template.md .release-private/appstore-i18n-101-submission-evidence.md
```

Complete the private copy with the exact build/device/App Store Connect information. Never commit the completed copy.

The historical APPSTORE26 files remain in `docs/launch/` for audit/regression reference and should not be rewritten to look like the 1.0.1 release.
