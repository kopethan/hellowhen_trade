# PLACE-ADDR1 — Place/address storage audit

Date: 2026-07-04

Scope: documentation and rollout planning only. No runtime, schema, API, web, native, or migration behavior changes.

## Product rule

Offline Places and offline Plan stops must become provider-selected addresses, not free-text meeting notes.

A future offline place create/update should be accepted only when the submitted payload includes all of these provider-backed fields:

- `formattedAddress`
- `latitude`
- `longitude`
- `googlePlaceId` or an equivalent stable provider place reference
- `locationSource = google_places`
- `addressValidationStatus = confirmed`

Manual text can still be used as helper copy or private instructions, but manual text alone must not make a place valid for offline mode.

Online Places should stay possible without an offline address. Online mode should require the existing online/link fields that the product supports, normally `onlineUrl` and optional `onlineLabel`.

Hybrid Places are not part of this first rollout. The current persisted modes are `local` and `remote`, so hybrid should wait until there is an explicit model and UI for it.

## Current schema foundation

Relevant schema: `apps/api/prisma/schema.prisma`

### Existing enums

The repo already has the needed location-source and validation enums:

```prisma
// Current schema names
PlanPlaceMode: local | remote
PlaceLocationSource: manual | google_places
PlaceAddressValidationStatus: confirmed | needs_review | unsupported
```

### `Place`

Reusable `Place` already has provider-backed fields:

- `mode`
- `areaLabel`
- `addressPublicText`
- `addressPrivateText`
- `googlePlaceId`
- `googlePlaceName`
- `formattedAddress`
- `googleMapsUri`
- `latitude`
- `longitude`
- `locationSource`
- `addressValidationStatus`
- `onlineLabel`
- `onlineUrl`
- static-map template fields

Important finding: the model is already ready for basic Google-confirmed address enforcement. A schema migration is not required for the first validation pass.

Missing if we later want richer address display/backfill:

- address components JSON
- country/locality/postal-code convenience columns
- last provider sync timestamp
- provider place types

These are optional later additions and should not block PLACE-ADDR2/3.

### `PlanPlace`

Plan stop snapshots already have the same core provider-backed fields:

- `placeId` optional link to a reusable Place
- `mode`
- `title`
- `note`
- `addressPublicText`
- `addressPrivateText`
- `googlePlaceId`
- `googlePlaceName`
- `formattedAddress`
- `googleMapsUri`
- `latitude`
- `longitude`
- `locationSource`
- `addressValidationStatus`
- `onlineLabel`
- `onlineUrl`
- static-map template fields

The snapshot design is good. When a reusable Place is added to a Plan, the Plan stop should preserve the selected provider address data, so a later edit to the reusable Place does not silently rewrite an already-published plan.

## Current API behavior

Relevant files:

- `apps/api/src/modules/places/places.routes.ts`
- `apps/api/src/modules/plans/plans.routes.ts`
- `apps/api/src/modules/places/googlePlaces.routes.ts`
- `packages/contracts/src/plans.ts`
- `packages/api-client/src/index.ts`

### Google provider endpoints already exist

The API already exposes Google provider endpoints under authenticated Places routes:

- `GET /places/google/search`
- `GET /places/google/details`
- `POST /places/google/validate-address`

The implementation uses server-side config from `apps/api/src/config/env.ts`:

- `GOOGLE_PLACES_ENABLED`
- `GOOGLE_ADDRESS_VALIDATION_ENABLED`
- `GOOGLE_MAPS_SERVER_API_KEY`
- `GOOGLE_PLACES_DEFAULT_LANGUAGE`
- `GOOGLE_PLACES_COUNTRY_CODES`
- `GOOGLE_PLACES_REQUEST_TIMEOUT_MS`

This means web and native do not need direct Google client keys for the first provider-selected address flow. They can call the Hellowhen API, and the API can call Google server-side.

### Weakness in Places API writes

Current `POST /places` and `PATCH /places/:placeId` still trust user-supplied text.

Observed weak patterns:

- `addressPublicText` can be saved directly for `mode = local`.
- `formattedAddress` can fall back to `addressPublicText`.
- `locationSource` can be inferred from `googlePlaceId`, but a local place is not required to have a confirmed provider selection.
- Static-map candidate logic can consider manual text/address labels.

Future PLACE-ADDR3 should stop treating typed text as a valid offline address.

### Weakness in Plan place writes

Current plan create/update helpers still allow custom local Plan stops with manual text.

Observed weak patterns:

- custom Plan stops can save `addressPublicText` for `mode = local`.
- `formattedAddress` can fall back to manual text.
- static-map snapshots can be assigned from manual text.
- reusable Place snapshots copy whatever address quality exists on the source Place.

Future PLACE-ADDR3 should validate both direct Plan stop payloads and snapshots from reusable Places.

## Current web behavior

Relevant files:

- `apps/web/src/features/plans/GooglePlacePicker.tsx`
- `apps/web/src/features/plans/PlaceCreateClient.tsx`
- `apps/web/src/features/plans/PlanCreateClient.tsx`
- `apps/web/src/features/plans/PlanEditClient.tsx`
- `apps/web/src/features/plans/PlanDetailClient.tsx`

### Good foundation

The web app already has a Google place picker component.

### Main gap

Create Place and Create Plan mostly store the selected/typed label as a plain `location` string and submit it as `addressPublicText`. They do not reliably carry the selected provider result into the final create payload.

Future PLACE-ADDR4 should store the selected provider result in form state and submit provider-backed fields:

- `googlePlaceId`
- `googlePlaceName`
- `formattedAddress`
- `googleMapsUri`
- `latitude`
- `longitude`
- `locationSource = google_places`
- `addressValidationStatus = confirmed`

Manual typing should clear the selected provider result. Offline save/publish should be disabled until a provider result is selected.

## Current native behavior

Relevant file:

- `apps/mobile/src/features/plans/PlansScreens.tsx`

### Good foundation

Native already has Google place search UI pieces and a mobile-friendly result display.

### Main gap

Parent forms still mostly keep only a `location` string for offline place state, then submit `addressPublicText`. The selected provider result is not carried end-to-end into Place/Plan create payloads.

Future PLACE-ADDR5 should mirror web behavior:

- keep the selected provider result in parent form state
- clear it when manual text changes
- block offline create/save until selected result exists
- submit provider-backed fields
- show a friendly unavailable state when the provider is disabled or unavailable

## Provider-unavailable behavior

When Google Places is disabled, misconfigured, rate-limited, or unavailable, production must not fall back to accepting random offline text.

Expected future UX:

- Offline mode: show a friendly unavailable/disabled state.
- Online mode: still allow online place creation if a valid online URL is present.
- Existing old places: remain readable.
- Editing an old invalid offline place: ask the user to select a real address before saving as offline.

Local/dev can keep a clear test-only path if needed, but production validation should remain strict.

## Existing data cleanup strategy

Old rows may already contain invalid offline data. Do not delete real user data by default.

Add a dedicated cleanup patch before or alongside strict validation:

```txt
PLACE-ADDR2B — Invalid offline place audit/cleanup script
```

Invalid offline examples:

- `mode = local` with only `addressPublicText`
- `mode = local` with `locationSource = manual`
- `mode = local` missing `googlePlaceId`
- `mode = local` missing `latitude` or `longitude`
- `mode = local` with `addressValidationStatus != confirmed`
- local starter/library rows that contain prompt text instead of a real address

Recommended cleanup script behavior:

- dry-run is the default
- print counts by table/source/status
- print affected ids/titles in a reviewable report
- convert invalid local rows to remote only when a valid `onlineUrl` already exists
- archive invalid reusable `Place` rows when they cannot be fixed automatically
- mark invalid `PlanPlace` rows as `unsupported`/`needs_review` rather than deleting them
- support a dangerous delete option only for explicit test/seed data

Implemented command shape:

```bash
npm run places:address-audit
npm run places:address-cleanup -- --dry-run --convert-online-when-url --archive-places --mark-plan-stops-unsupported
npm run places:address-cleanup -- --apply --convert-online-when-url --archive-places --mark-plan-stops-unsupported
```

Full usage is documented in `docs/plans/place-address-cleanup.md`.

Plan stops should not be deleted by default because deleting stops can damage existing plans.

## Starter plan ideas/templates

Relevant file:

- `packages/shared/src/planIdeas.ts`

PLACE-ADDR6 updates starter plan ideas from our side.

Implemented rule:

- starter idea location text is stored as `locationPrompt`, not `addressPublicText`
- offline starter stops open Create Plan with an empty address field and must require the user to search and select a real provider address before publish
- online starter stops keep descriptive labels but no fake URL; the user must add a valid online URL before publish

Good prompt examples:

- `Search and select a real cafe near you.`
- `Choose a real public meetup address.`
- `Select the exact venue before publishing.`

Bad saved-address examples:

- `A calm cafe or public coffee place`
- `Public park or outdoor place`
- `Local meetup location`

## Google Cloud setup notes

Use the backend provider proxy first. That means the first rollout should need only server-side Google credentials.

Enable these Google Cloud APIs when the feature is intentionally turned on:

- Places API (New)
- Address Validation API only when `GOOGLE_ADDRESS_VALIDATION_ENABLED=true`
- Maps Static API only if static map card previews are enabled

Official references to re-check before production rollout:

- Places API (New) setup: `https://developers.google.com/maps/documentation/places/web-service/get-api-key`
- Address Validation API setup: `https://developers.google.com/maps/documentation/address-validation/get-api-key`
- Maps Static API setup: `https://developers.google.com/maps/documentation/maps-static/get-api-key`
- Google Maps Platform API key security guidance: `https://developers.google.com/maps/api-security-best-practices`
- Google Maps Platform pricing: `https://developers.google.com/maps/billing-and-pricing/pricing`

### Recommended key split

For current backend-proxy architecture:

```txt
Server Places/Address key:
  Application restriction: API server IP addresses
  API restrictions:
    - Places API (New)
    - Address Validation API only if enabled
```

If Static Maps image URLs are sent directly to clients:

```txt
Static Maps key:
  Application restriction: HTTP referrers / websites
  API restrictions:
    - Maps Static API
```

Do not use unrestricted keys in production.

Separate browser, Android, or iOS Google keys are not needed for the current provider-proxy picker. Add them later only if the app starts using Google Maps JavaScript SDK or native Google SDKs directly.

## Rollout order

Recommended patch order after this audit:

1. `PLACE-ADDR2` — Shared address/provider types + validation helpers.
2. `PLACE-ADDR2B` — Invalid offline place audit/cleanup script.
3. `PLACE-ADDR3` — API Create/Update Place validation for offline addresses.
4. `PLACE-ADDR4` — Web Create Place address picker enforcement.
5. `PLACE-ADDR5` — Native Create Place address picker enforcement.
6. `PLACE-ADDR6` — Plan starter ideas/templates cleanup.
7. `PLACE-ADDR7` — Google provider smoke/parity docs and smoke script updates.

## PLACE-ADDR7 smoke/parity

PLACE-ADDR7 adds the final smoke/parity guide and root command:

```bash
npm run places:address-provider-smoke
```

Full provider rollout checks are documented in `docs/plans/google-provider-smoke-parity.md`. The command verifies that manual offline rows are blocked, online Places remain allowed, provider-unavailable states are friendly, and real Google-backed offline Places/Plan stops work when `EXPECT_GOOGLE_PLACES_ENABLED=true`.

The existing hidden Places/Plans smoke scripts now use valid remote/online destinations for generic create/join/edit checks. Real offline address coverage belongs in the dedicated provider smoke command.

## Acceptance checklist for later validation patches

A future strict validation pass is ready when all of these are true:

- offline create without provider selection is rejected by API
- offline create with provider selection is accepted by API
- online create with valid online URL is accepted by API
- online create without usable online destination is rejected by API
- old invalid offline rows remain readable
- old invalid offline rows cannot be re-saved as valid offline rows without selecting a real provider address
- static map URLs are not generated from manual text-only addresses
- starter plan ideas no longer save fake offline addresses
- first-launch guard behavior is unchanged
- Plans / Me / Trade navigation behavior is unchanged
