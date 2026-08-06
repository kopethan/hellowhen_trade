# iOS EAS build requirements

Hellowhen iOS production builds use marketing version `1.0.0` for the APPSTORE26 replacement submission.

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

The rejected binary used build `25`. The replacement must use build `26` or greater. Do not reset the remote value without comparing it with the latest build already issued in App Store Connect.

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
docs/launch/appstore26-production-release.md
docs/launch/appstore26-app-review-resubmission.md
```

## Production build

From `apps/mobile`:

```powershell
eas build --platform ios --profile production --clear-cache
```

Use `--clear-cache` for the first replacement build after native configuration and App Review fixes. Do not auto-submit: record the EAS build ID, upload that exact build deliberately with EAS Submit, then complete the iPhone/iPad checklist through TestFlight before resubmitting for App Review.
