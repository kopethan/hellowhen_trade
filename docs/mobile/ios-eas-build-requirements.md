# iOS EAS build requirements

Hellowhen iOS production builds now target marketing version `1.0.1` for the next normal App Store update. Public version `1.0.0` remains the historical released version until 1.0.1 is approved and released.

The mobile `production`, `preview`, and `development` EAS profiles pin the iOS image to `macos-sequoia-15.6-xcode-26.0`. The app config sets the iOS deployment target to `15.0` through `expo-build-properties`, which is applied during prebuild.

## Version management

The user-facing marketing version is stored in:

```txt
apps/mobile/app.json → expo.version
```

The developer-facing iOS build number is managed remotely by EAS:

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true
    }
  }
}
```

Before every production build, inspect the current remote value from `apps/mobile`:

```powershell
eas build:version:get --platform ios --profile production
```

The 1.0.1 release must use iOS build `27` or greater. Do not add a local `ios.buildNumber` and do not reset the EAS remote number blindly.

- If the latest issued build is `26`, keep remote `26` so production auto-increment creates `27`.
- If App Store Connect already contains a higher build, keep/reconcile to the latest issued sequence and create the next unused build.
- Run `eas build:version:set` only when EAS remote state genuinely needs reconciliation with App Store Connect.

## Required preflight

From the repository root:

```powershell
npm ci
npm run mobile:release-preflight
npm run mobile:submission-preflight
npm run mobile:store-readiness
npm run typecheck
npm run build
```

Then follow:

```txt
docs/launch/appstore-i18n-101-production-release.md
docs/launch/appstore-i18n-101-ios-device-release-smoke.md
```

APPSTORE-I18N3 must be complete before sending the final version to App Review because that patch supplies the English (U.S.) store metadata, screenshots/review-note checklist, and What's New content.

## Production build

From `apps/mobile`:

```powershell
eas build --platform ios --profile production --clear-cache
```

Use `--clear-cache` for the first 1.0.1 candidate because the preceding localization patch changed native iOS bundle metadata. Do not auto-submit. Record the EAS build ID, deliberately upload that exact production build, complete TestFlight/device QA, and only then select it for the 1.0.1 App Store version.
