# APPSTORE26-RELEASE1 — Production version and build runbook

Use this runbook only after the APPSTORE26 patch chain is applied and committed.

## Release identity

```txt
App: Hellowhen
Bundle ID: com.hellowhen.app
App Store Connect app ID: 6781399122
Marketing version: 1.0.0
Rejected build: 25
Replacement iOS build: 26 or greater
EAS profile: production
API: https://api.hellowhen.com
Public web: https://www.hellowhen.com
```

The marketing version is controlled by `apps/mobile/app.json`. The developer-facing iOS build number is managed remotely by EAS because `cli.appVersionSource` is `remote` and the production profile uses `autoIncrement: true`.

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
- any command fails;
- the marketing version is not `1.0.0`;
- the production API or public web URL differs from the approved release values;
- a hidden release flag is enabled.

Record the commit SHA before starting the EAS build. Do not amend or rebuild from a different commit after device sign-off.

## 2. Inspect the remote iOS build number

From `apps/mobile`:

```powershell
cd apps/mobile
eas login
eas build:version:get --platform ios --profile production
```

Compare the remote value with App Store Connect.

- If the latest issued iOS build is `25`, leave the remote value at `25`; production auto-increment should create build `26`.
- If a build newer than `25` already exists, keep that newer value; the replacement build must increment beyond it.
- If the remote value is missing or lower than the latest build in App Store Connect, reconcile it before building.

**Do not run `eas build:version:set` blindly.** It can reset the remote source to an already-used number. Use it only after checking App Store Connect, and enter the latest developer-facing build number already issued—not the number you hope to create.

When reconciliation is actually required:

```powershell
eas build:version:set --platform ios --profile production
```

Then rerun:

```powershell
eas build:version:get --platform ios --profile production
```

## 3. Create the production binary

Use a clean production build for the first replacement after the rejection fixes:

```powershell
eas build --platform ios --profile production --clear-cache
```

Do not use `--auto-submit`. Record the completed build first, then upload that exact build deliberately to App Store Connect for TestFlight QA. EAS Submit uploads the binary; it does not replace the later App Store Review action.

When the build completes, record:

- EAS build ID and URL;
- commit SHA;
- marketing version shown by EAS;
- iOS build number;
- production API and web URLs;
- build completion time.

The iOS build number must be `26` or greater and must not already exist in App Store Connect.

## 4. Upload the exact build to App Store Connect

After the build completes and the static release checks remain green:

```powershell
eas submit --platform ios --profile production
```

Select the exact EAS build ID recorded in step 3. For a less ambiguous upload, use:

```powershell
eas submit --platform ios --profile production --id <EAS_BUILD_ID>
```

The production submit profile is pinned to App Store Connect app `6781399122`. This upload makes the build available for App Store Connect/TestFlight processing; do not submit the version for App Review yet.

Never commit Apple credentials, app-specific passwords, API private keys, reviewer passwords, or reusable session tokens.

## 5. Test the exact TestFlight binary

After App Store Connect finishes processing, install the exact uploaded production build through TestFlight and complete:

```txt
docs/launch/appstore26-ios-device-review-smoke.md
docs/launch/mobile-ugc-safety-review-checklist.md
```

Required rejection regression:

- no general Beta/demo/prototype/test-build presentation;
- Apple Maps appears first for eligible Place and Plan route actions;
- Google Maps remains optional;
- the iPad Air 11-inch compatibility presentation remains usable.

Do not sign off from Expo Go, a development client, a preview profile, an ad hoc rebuild, or a different TestFlight build.

## 6. App Store Connect final checks and App Review resubmission

Follow the complete submission document:

```txt
docs/launch/appstore26-app-review-resubmission.md
```

Before resubmitting the version to App Review:

- run `npm run mobile:submission-preflight`;
- select marketing version `1.0.0` and the exact tested build number;
- confirm the privacy policy URL is `https://hellowhen.com/legal/privacy`;
- confirm screenshots and descriptions do not present the app as Beta;
- confirm reviewer credentials still work from a clean install;
- confirm the reviewer account contains the prepared public Plan with mapped offline Places;
- paste the exact APPSTORE26 App Review Information notes and rejection reply after replacing every placeholder;
- add the corrected item back to the unresolved submission before choosing **Resubmit to App Review**;
- verify the selected binary matches the recorded EAS build ID, commit, version, and build number.

Stop submission if App Store Connect shows a different binary from the one tested.

## 7. Keep release evidence private

Copy the blank template to the ignored private release directory:

```powershell
New-Item -ItemType Directory -Force .release-private | Out-Null
Copy-Item docs/launch/appstore26-submission-evidence-template.md .release-private/appstore26-submission-evidence.md
```

The completed record may contain build URLs, reviewer-account details, device identifiers, and App Store Connect notes. The repository may contain blank checklists and non-secret app identifiers, but it must not contain credentials or completed private evidence.
