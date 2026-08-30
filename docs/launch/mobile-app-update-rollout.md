# Mobile app update rollout runbook

This runbook activates the Hellowhen native update prompt introduced by APPUPDATE1–APPUPDATE4. The API is the policy authority; the mobile app reads the installed native marketing version/build and never scrapes App Store or Google Play pages.

## Safety rules

- Keep `MOBILE_RELEASE_POLICY_ENABLED=false` while shipping/testing the native update code itself.
- Optional first; mandatory later.
- Treat iOS and Android as independent rollout targets. A platform with incomplete configuration fails open.
- Do not raise the minimum-supported target until the replacement binary is confirmed downloadable from the exact App Store / Google Play track used by the affected users on a physical device.
- Never make a not-yet-available build mandatory.
- A network/API/configuration failure must remain fail-open on the device.
- The immediate rollback is `MOBILE_RELEASE_POLICY_ENABLED=false`; deploy/reload API configuration and probe again.

## 1. Before any activation

Run the focused automated checks from the repository root:

```powershell
npm run app-update:safety
```

Then run the normal mobile store-readiness workflow. APPUPDATE4 does not change the active marketing-version release preflight; resolve any existing version/runbook mismatch separately before a store build.

Confirm the release-policy endpoint is deployed but disabled:

```powershell
npm run app-update:probe -- --api-url=https://api.hellowhen.com --platform=ios --version=1.0.2 --build=31 --expect=current
npm run app-update:probe -- --api-url=https://api.hellowhen.com --platform=android --version=1.0.2 --build=13 --expect=current
```

Use real installed build numbers for the binaries you are probing. While the master flag is false, the response must be `enabled: false`, `status: current`, and `Cache-Control: no-store`.

## 2. Publish and verify the replacement binary first

Build and submit the new native version through the existing reviewed EAS/store process. Do not change update-policy enforcement just because the upload was accepted by a store console.

For each platform you intend to activate:

1. Wait until the target binary is available in the intended App Store / Google Play track.
2. Install/update to that exact binary from the store on a physical device.
3. Record its marketing version and native build/version code.
4. Open Hellowhen and complete a basic launch/login/feed smoke.
5. Confirm the update button's store destination opens the correct Hellowhen listing.

Only then configure that platform's `LATEST` target.

## 3. Optional rollout

Example only — replace every value with the exact published binaries:

```env
MOBILE_RELEASE_POLICY_ENABLED=true

MOBILE_IOS_LATEST_VERSION=1.0.3
MOBILE_IOS_LATEST_BUILD=32
MOBILE_IOS_MIN_SUPPORTED_VERSION=1.0.2
MOBILE_IOS_MIN_SUPPORTED_BUILD=31

MOBILE_ANDROID_LATEST_VERSION=1.0.3
MOBILE_ANDROID_LATEST_BUILD=14
MOBILE_ANDROID_MIN_SUPPORTED_VERSION=1.0.2
MOBILE_ANDROID_MIN_SUPPORTED_BUILD=13

MOBILE_UPDATE_MESSAGE_EN=Bug fixes and improvements.
MOBILE_UPDATE_MESSAGE_FR=Corrections et améliorations.
MOBILE_UPDATE_MESSAGE_ES=Correcciones y mejoras.
```

Keep `MIN_SUPPORTED` at the oldest release that must still be allowed. This makes older-but-supported users optional, not mandatory.

Probe at least these cases per activated platform:

```powershell
# Old supported binary -> optional
npm run app-update:probe -- --api-url=https://api.hellowhen.com --platform=ios --version=1.0.2 --build=31 --expect=optional

# New published binary -> current
npm run app-update:probe -- --api-url=https://api.hellowhen.com --platform=ios --version=1.0.3 --build=32 --expect=current
```

On a physical device using an optional old binary, verify:

- Prompt title/body/version/release notes are readable in light and dark appearance.
- `Later` closes the prompt.
- Relaunching does not show the exact same optional target again.
- Changing `LATEST` to a newer tested target makes the prompt eligible again.
- `Update` opens the correct store listing.

## 4. Mandatory rollout

Mandatory rollout is an operational compatibility decision, not the default release mode. Keep an update optional until the replacement binary has been available long enough for your rollout needs and you have verified the store path again.

Immediately before raising `MIN_SUPPORTED`:

1. Reinstall/update the intended minimum-supported binary from the real store track on a physical device.
2. Confirm the store target is available in every country/track where affected Hellowhen users can run the old binary.
3. Confirm the API probe returns `current` for the intended minimum-supported binary.
4. Confirm the API probe returns `optional` for any older binary that you have not decided to block yet.
5. Record the exact minimum version/build in the release notes or deployment evidence.

Then raise only the intended platform's minimum target. Example:

```env
MOBILE_IOS_MIN_SUPPORTED_VERSION=1.0.3
MOBILE_IOS_MIN_SUPPORTED_BUILD=32
```

Probe an old binary:

```powershell
npm run app-update:probe -- --api-url=https://api.hellowhen.com --platform=ios --version=1.0.2 --build=31 --expect=mandatory
```

On the old physical-device binary verify:

- No `Later` action is visible.
- Android Back / modal dismissal cannot bypass a mandatory prompt.
- `Update` reaches the correct store listing.
- If store opening fails, Hellowhen keeps the prompt visible and presents the retry error instead of dismissing it.

## 5. Rollback

If a wrong version/build, store-availability problem, unexpected prompt, or API configuration issue is found:

```env
MOBILE_RELEASE_POLICY_ENABLED=false
```

Deploy/reload the API configuration immediately. Then probe the affected installed version and require `current`:

```powershell
npm run app-update:probe -- --api-url=https://api.hellowhen.com --platform=ios --version=1.0.2 --build=31 --expect=current
```

The mobile implementation intentionally fails open, so disabling the master flag is the fastest server-side way to remove both optional and mandatory prompts without a new app binary.

## 6. Configuration guardrails

For each platform:

- Version format is numeric `x.y.z`.
- Build/version code is a positive integer.
- `MIN_SUPPORTED` must never be newer than `LATEST`.
- Keep the store identifiers pinned to iOS App Store Connect app `6781399122` and Android package `com.hellowhen.app` unless the actual production app identifiers change.
- Do not use web scraping or third-party store-version pages to drive policy.
- Release notes are optional and must not contain secrets or private operational information.

The API fails open for incomplete/contradictory platform configuration, and the native client independently validates/recomputes the received policy before presenting an update. These are last-resort safety nets, not substitutes for the rollout checks above.
