# RELEASE-VERSION1 — Hellowhen 1.0.2 production release runbook

Use this runbook for the next normal Hellowhen mobile update after public version 1.0.1. The historical 1.0.0 and 1.0.1 release documents stay unchanged as evidence and regression context.

## Release identity

```txt
App: Hellowhen
Bundle ID: com.hellowhen.app
Android package: com.hellowhen.app
App Store Connect app ID: 6781399122
Previous public version: 1.0.1
Marketing version: 1.0.2
Minimum iOS build: 28
EAS profile: production
API: https://api.hellowhen.com
Public web: https://www.hellowhen.com
```

`apps/mobile/app.json` controls the marketing version. Developer-facing iOS build numbers and Android version codes remain managed remotely by EAS because `cli.appVersionSource` is `remote` and the production profile has `autoIncrement: true`.

Do not add local `ios.buildNumber` or `android.versionCode` values just to force a release number.

The production app-update policy must remain disabled while the 1.0.2 binaries are being built, reviewed, and rolled out for the first time:

```txt
MOBILE_RELEASE_POLICY_ENABLED=false
```

## 1. Freeze and validate the release commit

From the repository root:

```powershell
git status --short
git rev-parse HEAD
npm ci
npm run app-update:safety
npm run mobile:release-preflight
npm run typecheck
npm run build
```

Stop when any command fails, the worktree contains an unexpected source change, the marketing version is not `1.0.2`, or a store-hidden feature becomes visible.

RELEASE-METADATA1 is the active 1.0.2 App Store submission package and is versioned separately from the historical 1.0.1 artifacts. Before final App Review submission, use:

```txt
docs/launch/appstore-i18n-102-english-localization.md
docs/launch/appstore-i18n-102-en-US-metadata.json
docs/launch/appstore-i18n-102-submission-evidence-template.md
```

Run `npm run mobile:submission-preflight` and copy the exact approved 1.0.2 What's New / App Review Notes from that package. Keep the historical 1.0.1 APPSTORE-I18N3 files unchanged.

## 2. Inspect remote EAS versions before building

From `apps/mobile`:

```powershell
cd apps/mobile
eas login
eas build:version:get --platform ios --profile production
eas build:version:get --platform android --profile production
```

Compare each remote value with the latest build/version code already issued in App Store Connect and Google Play.

**Do not run `eas build:version:set` blindly.** Use it only if the remote source is actually behind the latest issued store value, and set the latest developer-facing number already issued rather than the number you hope to create.

The next iOS production binary must be build `28` or greater and must not duplicate a build already present in App Store Connect.

## 3. Create production binaries

Use the reviewed production profile. A clean build is preferred for this release because the app now includes the native `expo-application` module used by the update-policy gate.

```powershell
eas build --platform ios --profile production --clear-cache
eas build --platform android --profile production --clear-cache
```

Do not use `--auto-submit`.

Record for each completed binary:

- EAS build ID and URL;
- commit SHA;
- marketing version (`1.0.2`);
- generated iOS build number or Android version code;
- production API and public-web URLs;
- completion time.

## 4. Test the exact production binaries

Complete:

```txt
docs/launch/mobile-102-ios-device-release-smoke.md
docs/launch/mobile-ugc-safety-review-checklist.md
```

Also verify the new update-policy system remains non-blocking while production policy is disabled.

## 5. Submission handoff

After exact-binary QA passes and the 1.0.2 store metadata/review package is ready, upload deliberately. For iOS:

```powershell
eas submit --platform ios --profile production
```

Prefer selecting the exact recorded EAS build when prompted, or use:

```powershell
eas submit --platform ios --profile production --id <EAS_BUILD_ID>
```

Do not enable the production update policy merely because the binary was uploaded. Keep it disabled until the update-capable store release is actually available and a future release target is ready.
