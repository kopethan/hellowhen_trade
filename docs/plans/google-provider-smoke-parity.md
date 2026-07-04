# PLACE-ADDR7 — Google provider smoke and parity checks

Date: 2026-07-04

This document is the final smoke/parity checklist for the provider-selected offline Place rollout.

It assumes the previous address patches are applied:

1. `PLACE-ADDR1` — audit and provider/env docs
2. `PLACE-ADDR2` — shared provider address validation helpers
3. `PLACE-ADDR2B` — invalid offline cleanup script
4. `PLACE-ADDR3` — API offline/online address enforcement
5. `PLACE-ADDR4` — web address picker enforcement
6. `PLACE-ADDR5` — native address picker enforcement
7. `PLACE-ADDR6` — starter idea prompt cleanup

## Product invariant

Offline Places and offline Plan stops are valid only when they come from a provider-selected address payload.

Required offline fields:

```txt
mode = local
googlePlaceId
formattedAddress
latitude
longitude
locationSource = google_places
addressValidationStatus = confirmed
```

Manual text such as `addressPublicText`, starter prompt text, area labels, or private instructions can still be displayed as helper copy, but they must not make an offline destination valid.

Online Places remain valid without offline address fields when they include a supported online destination:

```txt
mode = remote
onlineUrl = http:// or https:// URL
onlineLabel optional
```

## Command summary

Run the cleanup audit before and after the rollout:

```bash
npm run places:address-audit
```

Dry-run the safe cleanup actions:

```bash
npm run places:address-cleanup -- --dry-run --convert-online-when-url --archive-places --mark-plan-stops-unsupported
```

Run the provider/address policy smoke:

```bash
npm run places:address-provider-smoke
```

Run it with Plans/Places enabled:

```bash
EXPECT_PLANS_ENABLED=true npm run places:address-provider-smoke
```

Run it with real Google provider checks enabled:

```bash
EXPECT_PLANS_ENABLED=true \
EXPECT_GOOGLE_PLACES_ENABLED=true \
GOOGLE_PLACE_SMOKE_QUERY="Eiffel Tower" \
GOOGLE_PLACE_SMOKE_COUNTRY=FR \
npm run places:address-provider-smoke
```

On Windows PowerShell:

```powershell
$env:EXPECT_PLANS_ENABLED="true"
$env:EXPECT_GOOGLE_PLACES_ENABLED="true"
$env:GOOGLE_PLACE_SMOKE_QUERY="Eiffel Tower"
$env:GOOGLE_PLACE_SMOKE_COUNTRY="FR"
npm run places:address-provider-smoke
```

## Smoke coverage

`scripts/place-address-provider-smoke.mjs` verifies:

- invalid offline reusable Place create is rejected with `missing_offline_provider_address`
- online reusable Place create/archive still works without offline address fields
- provider-disabled/provider-not-configured state is friendly when Google checks are not expected
- Google Places search/details works when explicitly expected
- Google Places search is only requested for queries with at least 3 characters
- Google details are fetched only after the user selects a suggestion
- Google details return a confirmed provider payload
- provider-backed offline reusable Place create/archive works
- provider-backed offline Plan create/cancel works

The script only creates short-lived smoke rows and archives/cancels them during the run.

## Existing smoke script parity

Two older smoke scripts were updated so they do not fight the new offline rule:

```txt
scripts/place-library-hidden-smoke.mjs
scripts/plans-hidden-smoke.mjs
```

They now use valid remote/online destinations for their generic create/join/edit checks. They should not create fake local addresses from manual text. Real offline Google-provider coverage belongs in `places:address-provider-smoke`.

## Web parity checklist

Create Place, web:

- Offline mode shows the Google place picker.
- Search waits for at least 3 typed characters and uses the existing debounce before calling Google.
- Typing manual address text clears the selected provider result.
- Save is disabled until a provider result is selected.
- Save sends `googlePlaceId`, `formattedAddress`, coordinates, `locationSource = google_places`, and `addressValidationStatus = confirmed`.
- Online mode hides or de-emphasizes offline address requirements.
- Online mode requires a valid `http://` or `https://` URL.
- Provider unavailable state blocks offline save instead of allowing free text.

Create Plan, web:

- Custom offline stops require a provider-selected address before publish.
- Saved/my/library Places that are invalid offline rows are disabled or marked “Fix first.”
- Starter idea local stops show prompts, not fake address values.
- Starter idea online stops require the user to provide a real online URL before publish.

## Native parity checklist

Create Place, native:

- Offline mode stores the selected Google result in parent form state.
- Search waits for at least 3 typed characters and uses the existing debounce before calling Google.
- Manual input clears the selected provider result.
- Continue/save is blocked until the selected provider result is confirmed.
- Online mode requires a valid `http://` or `https://` URL.
- Provider unavailable state blocks offline save instead of allowing free text.

Create Plan, native:

- Custom offline stops require a selected provider payload.
- Invalid reusable offline Places are not selectable as valid stops.
- Starter idea local stops remain prompts until the user selects a real address.

## API parity checklist

Reusable Place API:

```txt
POST /places mode=local with manual address only
  => reject missing_offline_provider_address

POST /places mode=local with confirmed Google payload
  => accept

PATCH /places/:placeId switching to remote with onlineUrl
  => accept and clear offline/map fields

POST /places mode=remote without onlineUrl
  => reject missing_online_place_destination

POST /places mode=remote with onlineUrl
  => accept
```

Plan API:

```txt
POST /plans with custom local PlanPlace and manual address only
  => reject missing_offline_provider_address before creating the Plan

POST /plans with saved reusable Place that is invalid local/offline
  => reject missing_offline_provider_address

POST /plans with confirmed Google local PlanPlace payload
  => accept

POST /plans with remote PlanPlace and onlineUrl
  => accept
```

## Google Cloud setup checklist

Enable only the APIs needed for the rollout:

- Places API (New)
- Address Validation API only when `GOOGLE_ADDRESS_VALIDATION_ENABLED=true`
- Maps Static API only when static map card previews are enabled

Use separate keys where possible:

```txt
Server Places key:
  Application restriction: API server IP addresses
  API restrictions: Places API (New), and Address Validation API only if enabled

Static Maps key:
  Application restriction: HTTP referrers / websites
  API restrictions: Maps Static API only
```

Google requires Places API (New) requests such as Place Details to specify the desired fields with a field mask. Keep backend field masks narrow so Google returns only data Hellowhen needs for address selection and map display.

Google Maps Platform security guidance recommends API restrictions and application restrictions for API keys. Do not ship unrestricted keys.

### Places monthly usage guard

The API has a lightweight in-memory monthly guard for Google Places autocomplete/details calls:

- `GOOGLE_PLACES_MONTHLY_SOFT_LIMIT` marks the provider as soft-limited for operators, but keeps offline address search working.
- `GOOGLE_PLACES_MONTHLY_HARD_LIMIT` pauses autocomplete/details before another Google request is issued.
- When the hard limit is reached, offline Place creation stays unavailable because typed/manual addresses are not accepted as fallback. Users can create an Online place with a valid link instead.

This guard is app-side protection only. Keep Google Cloud quotas/budgets enabled because they are the real billing hard stop across processes, restarts, and deployments.

## Required env for Google-backed smoke

Shared/API env:

```env
PLANS_ENABLED=true
PLANS_VISIBLE=true
PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS=true
GOOGLE_PLACES_ENABLED=true
GOOGLE_MAPS_SERVER_API_KEY=YOUR_SERVER_RESTRICTED_GOOGLE_MAPS_KEY
GOOGLE_PLACES_COUNTRY_CODES=FR
GOOGLE_PLACES_DEFAULT_LANGUAGE=en
GOOGLE_PLACES_REQUEST_TIMEOUT_MS=4500
GOOGLE_PLACES_MONTHLY_SOFT_LIMIT=9000
GOOGLE_PLACES_MONTHLY_HARD_LIMIT=10000
```

Optional:

```env
GOOGLE_ADDRESS_VALIDATION_ENABLED=false
GOOGLE_STATIC_MAPS_ENABLED=true
GOOGLE_STATIC_MAPS_API_KEY=YOUR_STATIC_MAPS_RESTRICTED_KEY
GOOGLE_STATIC_MAPS_ANONYMOUS_ENABLED=false
```

## Failure meanings

`missing_offline_provider_address`

: The caller is trying to save a local/offline destination without confirmed provider address fields. Fix UI payload wiring or select a real address.

`missing_online_place_destination`

: The caller is trying to save a remote/online destination without `onlineUrl`.

`google_places_disabled`

: Google provider feature flag is off. Offline creation should show an unavailable state, not manual fallback.

`google_places_not_configured`

: Provider flag is on but `GOOGLE_MAPS_SERVER_API_KEY` is missing.

`google_places_monthly_hard_limit`

: The app-side monthly hard limit paused Google Places autocomplete/details. Offline creation remains unavailable without provider-selected data; increase the limit only after checking Google Cloud quota/billing settings.

Google `400` or field-mask errors

: The provider route field mask is missing or asking for an unsupported field. Confirm the backend route still sends `X-Goog-FieldMask` for Places API (New) calls.

Google `403`

: Usually key restriction/API enablement problem. Confirm the server key is allowed from the API server IP and restricted to Places API (New).

Google `429`

: Quota or rate-limit problem. Keep app-side rate limits and Google Cloud quotas/budgets low during beta.

## Release gate

Do not enable strict production rollout until all of these are true:

- cleanup audit has been reviewed
- safe cleanup has been dry-run
- API rejects manual offline creates
- web blocks manual offline save
- native blocks manual offline save
- online places still save on web and native
- starter plan ideas no longer publish fake offline addresses
- Google provider smoke passes in staging with real key
- Static Maps uses coordinates/provider data only, not manual text
- first-launch guard behavior is unchanged
- Plans / Me / Trade navigation behavior is unchanged
