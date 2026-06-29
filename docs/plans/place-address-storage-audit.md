# PLACE-ADDR1 — Place/address storage audit

Date: 2026-06-29

Scope: audit only. No runtime, schema, API, web, or native behavior changes.

## Summary

Hellowhen already has a working Plan/Place foundation, but offline addresses are currently stored as free text. There is no Google Place ID, no normalized formatted address, no latitude/longitude, and no source marker proving an offline address came from a trusted provider.

That means the current system is good enough for user-entered meeting points, but not enough for:

- Google-confirmed offline addresses
- typo-tolerant address suggestions
- map/deep-link consistency
- distance filtering
- on-location presence verification
- profile trust stats based on verified offline visits

The safest next step is to add Google place/address fields behind feature flags, then migrate the create/edit place UI to require selecting a Google suggestion for offline places.

## Current database storage

Relevant schema: `apps/api/prisma/schema.prisma`

### `Place`

Current reusable Place fields:

- `mode: PlanPlaceMode` with `local | remote`
- `title`
- `description`
- `category`
- `tags`
- `areaLabel`
- `addressPublicText`
- `addressPrivateText`
- `onlineLabel`
- `onlineUrl`
- `defaultDurationMinutes`
- `defaultNote`
- `defaultMeetingInstructions`
- media through the generic media system

Missing for Google-confirmed offline addresses:

- `googlePlaceId`
- `googlePlaceName`
- `formattedAddress`
- `latitude`
- `longitude`
- `countryCode`
- structured components: street, postal code, locality, admin area
- `addressSource` / `locationSource`
- `addressValidationStatus`
- `addressVerifiedAt` / `lastGoogleSyncedAt`

### `PlanPlace`

Current plan-place snapshot fields:

- `planId`
- `placeId` optional link to reusable `Place`
- `order`
- `mode`
- `title`
- `note`
- `addressPublicText`
- `addressPrivateText`
- `onlineLabel`
- `onlineUrl`
- `startsAt`
- `endsAt`
- media through the generic media system

The snapshot pattern is already good. When a reusable Place is added to a Plan, `PlanPlace` copies the Place text fields. This is the right pattern for future Google fields too: accepted/published Plan places should keep a stable snapshot even if the reusable Place changes later.

Missing for future presence verification:

- `googlePlaceId`
- `formattedAddress`
- `latitude`
- `longitude`
- `locationSource`
- `addressValidationStatus`
- possible `verificationRadiusMeters`

## Current contracts

Relevant file: `packages/contracts/src/plans.ts`

Current place input/output contracts expose only text location fields:

- `areaLabel`
- `addressPublicText`
- `addressPrivateText`
- `onlineLabel`
- `onlineUrl`

Current plan-place input allows either:

- a saved `placeId`, or
- a custom `title`

The current validation message says: `Choose a saved place or enter a place title.` This means custom places are intentionally supported today.

For the Google-confirmed address direction, this rule should change later for offline places:

- remote places can keep manual online label/URL behavior
- offline reusable Places should require a selected Google place
- offline custom PlanPlace entries should either be removed or converted into a Google selection flow

## Current API behavior

Relevant files:

- `apps/api/src/modules/places/places.routes.ts`
- `apps/api/src/modules/plans/plans.routes.ts`
- `packages/api-client/src/index.ts`

### Places API

Existing routes:

- `GET /places/mine`
- `GET /places/library`
- `GET /places/:placeId`
- `POST /places`
- `PATCH /places/:placeId`
- `DELETE /places/:placeId` archives a place

Current behavior:

- `POST /places` stores `addressPublicText` directly from the client.
- `PATCH /places/:placeId` can update `addressPublicText` directly unless the Place is locked by usage in a Plan.
- Search matches `title`, `description`, and `areaLabel`, but not coordinates or Google metadata.
- Private details are already protected: `addressPrivateText` and `defaultMeetingInstructions` only show to owner/admin.

Good existing foundation:

- reusable Places can be private/public/library
- Hellowhen Library Places already exist as a separate source
- place locking prevents silent changes once used in Plans
- media support already exists
- owner/admin visibility rules are already partly in place

Main gap:

- API trusts free-text addresses from client forms.

### Plans API

Current behavior:

- `POST /plans` accepts `places` with free-text `addressPublicText`.
- `POST /plans/:planId/places` accepts free-text `addressPublicText`.
- When a `placeId` is supplied, the server snapshots reusable Place values into `PlanPlace`.
- Plan feed search includes `PlanPlace.addressPublicText`.
- Plan visibility already hides `addressPrivateText` unless viewer is owner or accepted participant.

Good existing foundation:

- snapshot model is already present for Plan places
- public/private place details are already separated
- plan-place media fallback to source Place media already exists

Main gap:

- PlanPlace snapshots do not include any structured geodata, so presence verification cannot be trusted yet.

### API client

Current API client has normal Place and Plan methods, but no Google resolver methods yet.

Needed later:

- `places.googleSearch(query)` or `places.searchGoogle(query)`
- `places.googleDetails(placeId)`
- possibly `places.validateAddress(...)`

## Current web UI behavior

Relevant files:

- `apps/web/src/features/plans/PlaceCreateClient.tsx`
- `apps/web/src/features/plans/PlanCreateClient.tsx`
- `apps/web/src/features/plans/PlanEditClient.tsx`
- `apps/web/src/features/plans/PlanDetailClient.tsx`
- `apps/web/src/features/plans/PlanPreviewDeck.tsx`
- `apps/web/src/features/plans/planFilters.ts`

### Web Create/Edit Place

Current offline UI:

- field label: `Area / address`
- placeholder: `Paris 11 or a public spot`
- stored as `addressPublicText`

This is free text. There is no suggestion list, no Google selection, and no address confirmation state.

### Web Create Plan

Current Plan place details support:

- reusable My Place
- Hellowhen Library Place
- Create new Place
- Custom Place

For custom offline places, UI shows:

- `Address or meeting point`
- placeholder: `Search or enter an address`

This explicitly allows a non-Google custom typed address.

### Web Plan detail/display

Plan detail shows:

- local place location from `addressPublicText` or `sourcePlace.areaLabel`
- remote place location from `onlineLabel` or `onlineUrl`
- private address only if allowed by backend serialization

This can be extended later to show:

- Google-confirmed address badge
- Open in Maps action
- Verify presence action

## Current native mobile UI behavior

Relevant file:

- `apps/mobile/src/features/plans/PlansScreens.tsx`

Current native create/edit place state includes only:

- `location`
- `onlineLabel`
- `onlineUrl`

For offline Places, `location` is sent as `addressPublicText`.

Current native Create Plan and Create Place also allow custom text:

- Create Plan place detail: `Address or meeting point`
- Create Place: `Area / address`

Native already has a good route/state structure for My Places, Hellowhen Library, and Create Place. The Google picker can be inserted into those existing flows.

## Privacy and safety notes

The current model already separates public and private address text:

- `addressPublicText`
- `addressPrivateText`

That is useful, but future Google data needs stronger privacy rules:

- store exact lat/lng for a public venue only if it is the selected public place
- avoid exposing exact private-only instructions to public viewers
- for presence verification, do not expose a user’s raw current location
- store rounded verification coordinates or only distance/status metadata
- never show live location or visit history publicly

## Recommended Google-address field additions later

Add to both `Place` and `PlanPlace` so reusable Places and Plan snapshots stay aligned:

```prisma
// provider identity
googlePlaceId          String?
googlePlaceName        String?
locationSource         PlaceLocationSource @default(manual)
addressValidationStatus PlaceAddressValidationStatus @default(unverified)

// normalized display
formattedAddress       String?
addressLine1           String?
locality               String?
administrativeArea     String?
postalCode             String?
countryCode            String?

// geodata for maps / distance / verification
latitude               Decimal? @db.Decimal(10, 7)
longitude              Decimal? @db.Decimal(10, 7)

// maintenance
googlePlaceTypes       String[] @default([])
googleViewportJson     Json?
lastGoogleSyncedAt     DateTime?
```

Possible enums:

```prisma
enum PlaceLocationSource {
  manual
  google_places
}

enum PlaceAddressValidationStatus {
  unverified
  google_confirmed
  needs_review
  unsupported
}
```

Important: keep `addressPublicText` temporarily for backwards compatibility, but after Google selection, set it from `formattedAddress` or a safe public display line.

## Recommended migration strategy

1. Add nullable Google/address fields to `Place` and `PlanPlace`.
2. Keep old `addressPublicText` working.
3. Mark old manually entered local places as:
   - `locationSource = manual`
   - `addressValidationStatus = unverified`
4. New offline places created through the UI should require Google selection when `GOOGLE_PLACES_ENABLED=true`.
5. Later add a backfill/review tool for old manual addresses.
6. Only enable presence verification for places with:
   - `locationSource = google_places`
   - valid `latitude` and `longitude`

## Recommended next patches

### PLACE-ADDR2 — Google place contract + backend resolver

Scope:

- add feature flags
- add shared Google place result contracts
- add backend resolver endpoints under `/places/google/*`
- server uses Google API key, not the browser/mobile client
- normalize Google responses into Hellowhen shape
- no DB write yet unless selected by user

Suggested routes:

- `GET /places/google/search?query=...`
- `GET /places/google/details?placeId=...`

Optional later:

- `POST /places/google/validate-address`

### PLACE-ADDR3 — Schema fields for Google-confirmed places

Scope:

- Prisma schema migration
- contract DTO/input updates
- API create/update writes Google-selected fields
- PlanPlace snapshot copies Google fields from Place
- old text fields preserved for compatibility

This can be done before or after the resolver patch, but it should happen before UI requires Google selection.

### PLACE-ADDR4 — Web offline place picker

Scope:

- Create/Edit Place web
- Create Plan custom offline place web
- selected Google place card
- disable save/publish until Google place selected when feature enabled
- fallback to manual fields only when feature disabled

### PLACE-ADDR5 — Native offline place picker

Scope:

- native Create/Edit Place
- native Create Plan custom offline place
- selected Google place card
- mobile-friendly suggestions

### PLACE-ADDR6 — Plan detail offline place display polish

Scope:

- web + native Plan detail
- Google-confirmed badge
- Open in Maps action
- presence verification placeholder if geodata exists

## Conclusion

The current system is structurally ready for Google-confirmed places because it already has reusable Places, PlanPlace snapshots, privacy separation, media, My Places, and Hellowhen Library. The missing foundation is structured provider-backed location data.

Do not start presence verification until Google-confirmed address storage exists on both `Place` and `PlanPlace`.
