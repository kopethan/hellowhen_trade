# WeatherKit production configuration and verification

This runbook enables the server-side WeatherKit integration introduced by PLAN-WEATHER1A/1B and the attributed mobile display introduced by PLAN-WEATHER2.

Weather remains disabled unless the production API process receives `WEATHER_ENABLED=true` and a complete WeatherKit credential set. Do not add WeatherKit secrets to Expo/EAS public variables, `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`, mobile source, committed `.env` files, screenshots, support tickets, or chat messages.

## 1. Apple Developer setup

Use the Apple Developer account that owns Hellowhen.

1. Open **Certificates, Identifiers & Profiles**.
2. Under **Identifiers**, create or choose a **Services ID** for the WeatherKit REST service. A clear new identifier is `com.hellowhen.weather`, but any unique reverse-domain Services ID is valid. Record the exact identifier you register.
3. Under **Keys**, create a server authentication key with **WeatherKit** enabled. Give it a clear name such as `Hellowhen WeatherKit Server`.
4. Download the `.p8` private key and store it in a secure password/secret-management location. Apple private keys must not be committed to this repository. Do not send the key through chat or email.
5. Record these four values:
   - Apple Team ID
   - WeatherKit Services ID
   - WeatherKit Key ID
   - downloaded `.p8` private-key contents

The Services ID is the REST token subject. It is not the Hellowhen bundle ID unless you intentionally registered that exact string as a Services ID. This Hellowhen integration calls WeatherKit only from the server REST API; it does not use the native iOS WeatherKit framework, so do not add an iOS WeatherKit entitlement solely for this server path.

## 2. Production API secrets

Configure these values in the secret/environment mechanism that starts the Hellowhen API:

```env
WEATHER_ENABLED=true
WEATHER_PROVIDER=weatherkit
WEATHER_REQUEST_TIMEOUT_MS=4500
WEATHER_CACHE_TTL_SECONDS=900
WEATHER_CACHE_MAX_ENTRIES=500

WEATHERKIT_TEAM_ID=<10-character Apple Team ID>
WEATHERKIT_SERVICE_ID=<registered WeatherKit Services ID>
WEATHERKIT_KEY_ID=<10-character WeatherKit Key ID>
WEATHERKIT_PRIVATE_KEY=<complete .p8 private key>
```

The timeout/cache values above match the current defaults and may be omitted if the deployment intentionally uses those defaults.

`WEATHERKIT_PRIVATE_KEY` may contain real newlines or literal `\n` sequences; the server normalizes either representation. Preserve the complete `BEGIN PRIVATE KEY` / `END PRIVATE KEY` content.

The repository currently does not define the production host's process manager or secret-injection command. Use the same protected environment mechanism already used by the deployed API for credentials such as the database and other server-only providers, then restart/redeploy the API with that mechanism. Do not invent a new plaintext secret file solely for WeatherKit.

## 3. Verify the credentials before enabling user-visible weather

The repository includes a verifier that never prints the private key, generated JWT, or Hellowhen access token.

### Configuration and signing only

Run this in a shell where the production-style weather variables are available:

```bash
node scripts/weatherkit-deployment-check.mjs config
```

For verification on a secure workstation/server, you may point the verifier directly at the downloaded `.p8` instead of placing the key contents in the shell:

```bash
WEATHERKIT_PRIVATE_KEY_FILE=/secure/path/AuthKey_XXXXXXXXXX.p8 node scripts/weatherkit-deployment-check.mjs config
```

`WEATHERKIT_PRIVATE_KEY_FILE` is verifier-only convenience. The Hellowhen API runtime still reads `WEATHERKIT_PRIVATE_KEY`.

### Live Apple verification

After the configuration check passes:

```bash
node scripts/weatherkit-deployment-check.mjs apple
```

This makes authenticated WeatherKit availability and hourly-forecast requests using a fixed Paris sample coordinate. It does not send a Hellowhen user or Plan location. A successful run proves that the Team ID, Services ID, Key ID, private key, ES256 signing, and WeatherKit authorization work together.

If Apple returns `401`, re-check the exact Team ID, Services ID, Key ID, whether the key has WeatherKit enabled, and whether WeatherKit is enabled for the intended Apple developer configuration. Do not log or paste the generated JWT/private key while diagnosing it.

## 4. Deploy/restart the API

Only turn on production weather after the deployed API contains PLAN-WEATHER1A, PLAN-WEATHER1B, and PLAN-WEATHER2 server changes.

Use the existing Hellowhen API deployment process to deploy the current commit and restart the API with the new server secrets. The repository does not identify whether production uses systemd, PM2, a container, or another Lightsail process manager, so this runbook intentionally does not prescribe a restart command.

A configuration-only rollback is always available:

```env
WEATHER_ENABLED=false
```

Restart/redeploy the API after changing that value. The mobile client will simply stop showing weather; no mobile rebuild is required for this rollback.

## 5. End-to-end Hellowhen endpoint verification

Choose a real test Plan Place that satisfies all weather eligibility rules:

- `mode=local`
- the Plan Place itself has `startsAt`
- `startsAt` is in the future and less than seven days away
- the Plan Place or its reusable source Place has stored coordinates
- the authenticated test user can read that Plan

Do not use an Explore-only Place, remote Place, Plan-level date fallback, missing-coordinate Place, or a Place outside the forecast horizon.

In your own terminal, set temporary verification variables. Do not send the access token to chat:

```text
HELLOWHEN_API_BASE_URL=https://<production-api-host>
HELLOWHEN_ACCESS_TOKEN=<temporary authenticated test-user access token>
HELLOWHEN_PLAN_ID=<eligible plan id>
HELLOWHEN_PLAN_PLACE_ID=<eligible plan-place id>
```

Then run:

```bash
node scripts/weatherkit-deployment-check.mjs api
```

A passing run verifies:

- the authenticated Hellowhen route is reachable,
- the deployed provider is WeatherKit,
- a finite Celsius temperature is returned,
- required WeatherKit attribution metadata is present,
- the compact weather response does not expose latitude/longitude.

If the route returns `weather: null`, first confirm the Place eligibility above. The API deliberately uses `null` for ineligible Places, provider failures, missing forecast data, or incomplete required attribution.

## 6. Mobile verification

On an authenticated Android/iOS test build pointing at the deployed API:

1. Open a Plan containing the same eligible offline Place.
2. Confirm the Place card adds a compact temperature beside the offline mode label.
3. Tap the temperature and confirm Celsius/Fahrenheit toggles.
4. Leave and reopen the Plan and confirm the unit preference persists.
5. Confirm the official Apple Weather attribution mark is visible whenever temperature is visible.
6. Tap **Sources** and confirm Apple's legal attribution page opens.
7. Confirm a remote Place, a Place with no own `startsAt`, and an out-of-horizon Place do not show weather.

If the official attribution mark cannot load, the temperature should remain hidden by design.

## 7. Secret rotation

If the WeatherKit private key may have been exposed, create a replacement WeatherKit-enabled key first, deploy the new Key ID/private key, verify it, and only then revoke the old key. Never reuse a compromised key.

## Production acceptance checklist

- [ ] WeatherKit Services ID registered
- [ ] WeatherKit-enabled private key created and securely stored
- [ ] `WEATHERKIT_TEAM_ID` configured server-side
- [ ] `WEATHERKIT_SERVICE_ID` configured server-side
- [ ] `WEATHERKIT_KEY_ID` configured server-side
- [ ] `WEATHERKIT_PRIVATE_KEY` configured server-side
- [ ] `WEATHER_ENABLED=true` and `WEATHER_PROVIDER=weatherkit`
- [ ] `node scripts/weatherkit-deployment-check.mjs config` passes
- [ ] `node scripts/weatherkit-deployment-check.mjs apple` passes
- [ ] API deployed/restarted with secrets
- [ ] eligible Plan Place `api` verification passes
- [ ] mobile temperature renders only with official attribution
- [ ] Celsius/Fahrenheit preference persists
- [ ] remote/ineligible Places remain weather-free
- [ ] rollback procedure understood
