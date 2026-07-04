# Google Static Maps for Place visuals

This document explains the Hellowhen Google Static Maps feature so a future chat can continue the Google API Platform work without rediscovering the setup.

## Scope

The feature is for **Place / Plan Place visual backgrounds** only.

Priority order in the UI:

1. User uploaded Place image
2. Theme-aware Google Static Map URL
3. Hellowhen fallback visual

Important rule: **do not download, cache, or re-host the generated Google map image**. The app should use the generated Google Static Maps URL directly as an image source. Store only Place data and template choices.

Address-safety rule: Static Maps should be generated only from provider-selected offline address data, preferably coordinates from a selected Google Place. Do not generate map visuals from manual/free-text-only offline addresses.

## Cost-safe Plan detail rendering

Plan detail pages should avoid duplicate Static Maps image loads.

Current web behavior:

```txt
1 offline place:
- show the Place card visual only
- do not render an extra Location preview / route preview card

2+ offline places with map queries:
- show the Place cards first
- show one Route preview after the place list
- skip online places for Google Maps routing

Online places:
- do not use Google Static Maps
- keep normal online link actions
```

Map images should use normal browser lazy loading where possible. This reduces app-side duplicate requests, but it does not replace Google Cloud quotas/budgets because the final billable image request is made by the client browser or app.

## Patch stack

The current planned stack is:

```txt
PLACE-MAP1 — Static map visual foundation
PLACE-MAP2 — Theme-aware map template registry
PLACE-MAP3 — Free random template family assignment
PLACE-MAP4 — Place card light/dark visual rendering
PLACE-MAP5 — Plus manual template chooser later
PLACE-MAP6 — Static map budget guard
PLAN-MAP-COST1A — Web Plan detail duplicate map cleanup
PLAN-MAP-COST2A — Static Maps soft/hard guard foundation
```

Main files touched by the stack:

```txt
.env.example
apps/api/src/config/env.ts
apps/api/src/modules/places/placeStaticMap.ts
apps/api/src/modules/places/placeStaticMapTemplates.ts
apps/api/src/modules/places/places.routes.ts
apps/api/src/modules/plans/plans.routes.ts
apps/api/prisma/schema.prisma
packages/contracts/src/plans.ts
apps/web/src/features/plans/*
apps/mobile/src/features/plans/*
```

## Environment variables

Use separate API keys when possible: one server-restricted key for Places/Address Validation, one browser/referrer-restricted key for Static Maps. The current web/native address picker architecture should call Hellowhen API endpoints first, so browser, Android, and iOS Google client keys are not required unless a future patch switches to direct Google client SDK usage.

```env
# Google-confirmed offline place search
GOOGLE_PLACES_ENABLED=true
GOOGLE_ADDRESS_VALIDATION_ENABLED=false
GOOGLE_MAPS_SERVER_API_KEY=YOUR_SERVER_RESTRICTED_GOOGLE_MAPS_KEY
GOOGLE_PLACES_DEFAULT_LANGUAGE=en
GOOGLE_PLACES_COUNTRY_CODES=FR
GOOGLE_PLACES_REQUEST_TIMEOUT_MS=4500
GOOGLE_PLACES_MONTHLY_SOFT_LIMIT=9000
GOOGLE_PLACES_MONTHLY_HARD_LIMIT=10000

# Static map card previews
GOOGLE_STATIC_MAPS_ENABLED=true
GOOGLE_STATIC_MAPS_API_KEY=YOUR_STATIC_MAPS_RESTRICTED_KEY

# Keep public anonymous traffic off until quotas/budgets are safe.
# Logged-in users can still receive map URLs.
GOOGLE_STATIC_MAPS_ANONYMOUS_ENABLED=false

# Soft app-side caps. These estimate image URL exposures.
# After a soft limit, list/preview surfaces stop receiving Static Maps; detail pages can still receive them.
GOOGLE_STATIC_MAPS_DAILY_SOFT_LIMIT=250
GOOGLE_STATIC_MAPS_MONTHLY_SOFT_LIMIT=9000
# Hard app-side pause for all Static Maps URL issuance. Keep real billing caps in Google Cloud.
GOOGLE_STATIC_MAPS_MONTHLY_HARD_LIMIT=10000

# Template defaults
GOOGLE_STATIC_MAPS_DEFAULT_TEMPLATE=clean_local

# Optional Google Cloud map IDs. Leave blank to use URL style parameters from the template registry.
GOOGLE_STATIC_MAPS_DEFAULT_MAP_ID=
GOOGLE_STATIC_MAPS_LIGHT_MAP_ID=
GOOGLE_STATIC_MAPS_DARK_MAP_ID=
```

Recommended first launch values:

```env
GOOGLE_PLACES_ENABLED=true
GOOGLE_ADDRESS_VALIDATION_ENABLED=false
GOOGLE_STATIC_MAPS_ENABLED=true
GOOGLE_STATIC_MAPS_ANONYMOUS_ENABLED=false
GOOGLE_STATIC_MAPS_DAILY_SOFT_LIMIT=250
GOOGLE_STATIC_MAPS_MONTHLY_SOFT_LIMIT=9000
GOOGLE_STATIC_MAPS_MONTHLY_HARD_LIMIT=10000
GOOGLE_PLACES_COUNTRY_CODES=FR
```

## Google Cloud Console setup

In the Hellowhen Google Cloud project:

1. Link a billing account.
2. Enable **Places API (New)**.
3. Enable **Maps Static API**.
4. Keep **Address Validation API** disabled unless `GOOGLE_ADDRESS_VALIDATION_ENABLED=true` is intentionally enabled later.
5. Create API key: `Hellowhen Server Places Key`.
6. Create API key: `Hellowhen Static Maps Key`.
7. Create budgets and quota limits before public rollout.

### Server Places key restrictions

Use this key for API server calls such as Google Places search/details.

```txt
Application restriction:
- IP addresses
- Add the production Lightsail static public IP
- Add staging IP only if needed

API restrictions:
- Places API (New)
- Address Validation API only if intentionally enabled later
```

### Static Maps key restrictions

Use this key only for rendered map image URLs. Static Maps URLs are visible to clients, so keep this key separate from the server Places key.

```txt
Application restriction:
- HTTP referrers / websites
- https://hellowhen.com/*
- https://www.hellowhen.com/*
- http://localhost:3000/* only for local testing

API restrictions:
- Maps Static API
```

Do not put an unrestricted Static Maps key in production.

### Web/mobile client key note

The current provider flow is backend-proxied through Hellowhen API routes, not direct Google SDK calls. Do not add browser, Android, or iOS Google API keys for address picking until a future patch intentionally introduces direct Maps JavaScript SDK or native Google SDK usage. If direct client SDKs are added later, use separate keys with the matching application restrictions:

```txt
Web browser key:
- HTTP referrers only
- Hellowhen production/staging origins only
- API restrictions for the specific browser SDK/API in use

Android key:
- Android package + SHA certificate restriction
- API restrictions for the specific Android SDK/API in use

iOS key:
- iOS bundle ID restriction
- API restrictions for the specific iOS SDK/API in use
```

## Quota and budget settings

App-side budget guards are useful, but Google Cloud limits are still required.

Recommended starting Cloud quotas:

```txt
Maps Static API:
- Daily quota: 250 to 300 requests/day while testing
- Raise slowly after checking real usage

Places API (New):
- Daily quota: 2,000 to 5,000 requests/day for beta
- Lower it if only internal testing

Address Validation API:
- Keep disabled or set a very low quota
```

Create a Google Cloud billing budget:

```txt
Budget name: Hellowhen Maps Platform Beta
Amount: 10 USD or 20 USD for first beta
Alerts: 50%, 80%, 100%, forecasted 100%
```

Budget alerts do not automatically stop usage, so API quotas and app-side guards still matter.

## Cost reference

Verify pricing before launch because Google can change prices.

As of the last review, relevant Google Maps Platform pricing used by this feature was:

```txt
Static Maps:
- 10,000 free events/month
- then about $2.00 per 1,000 events up to 100,000/month

Places Autocomplete Requests:
- 10,000 free events/month
- then about $2.83 per 1,000 events up to 100,000/month

Place Details Essentials:
- 10,000 free events/month
- then about $5.00 per 1,000 events up to 100,000/month

Address Validation Pro:
- 5,000 free events/month
- then about $17.00 per 1,000 events up to 100,000/month
```

Official pages to re-check:

```txt
Google Maps Platform pricing:
https://developers.google.com/maps/billing-and-pricing/pricing

Maps Static API get started:
https://developers.google.com/maps/documentation/maps-static/start

Google Maps API key security best practices:
https://developers.google.com/maps/api-security-best-practices

Google Cloud budgets:
https://cloud.google.com/billing/docs/how-to/budgets
```

## Template registry

Theme-aware template families are registered in the API layer and return both `lightUrl` and `darkUrl`.

Known template family keys:

```txt
clean_local
night_social
soft_pastel
minimal_address
city_grid
green_outdoor
warm_travel
premium_mono
```

Rules:

```txt
Free users:
- System chooses / assigns a template family.
- UI auto-selects light or dark URL based on active app theme.

Plus users later:
- User can manually choose the template family.
- UI still auto-selects light/dark variant unless a future lock option is added.
```

## Data model intent

Do not store the generated Static Maps image itself.

Do not save Google Static Maps output into app media, S3, a CDN, or local upload storage unless a later legal/provider audit confirms that the selected provider allows it. The current safe behavior is to store only metadata and render Google-provided Static Maps URLs directly.

Store only:

```txt
Place coordinates / Google place metadata
Place static map template family
Optional seed / assignment metadata
```

For offline Places, the minimum trusted map source is:

```txt
locationSource = google_places
addressValidationStatus = confirmed
googlePlaceId present
latitude present
longitude present
```

Manual text such as `addressPublicText` or `areaLabel` can be displayed as copy, but should not be enough to create a Google map card.

The API computes:

```txt
staticMap: {
  provider: "google_static_maps",
  templateFamily: "clean_local",
  source: "coordinates" | "address",
  width: number,
  height: number,
  scale: number,
  zoom: number,
  lightUrl: string,
  darkUrl: string
}
```

## Privacy rules

Public or logged-out views should not expose exact private addresses.

Use this order when choosing map source:

```txt
Owner / private view:
- Exact coordinates may be acceptable if the creator saved them.

Public view:
- Prefer public address text, area label, approximate coordinates, or a non-doorway display.
- Do not show private address text.
```

If a place is sensitive or private, do not issue a static map URL for anonymous/public views.


## Static Maps soft/hard guard behavior

The app guard is intentionally lightweight. It counts Static Maps URL issuance inside the API process, not guaranteed Google image fetches from every browser/app. Use Google Cloud budgets and Maps Static API quota limits as the real billing protection.

Current surfaces:

```txt
detail:
- Plan detail
- Place detail
- create/update responses

list:
- Plan feeds
- My Plans / Joined Plans
- My Places / Place Library

preview:
- reserved for future high-volume previews
```

Behavior:

```txt
Normal:
- issue Static Maps URLs where enabled

After daily/monthly soft limit:
- stop issuing Static Maps URLs for list/preview surfaces
- keep detail pages eligible so users can still inspect a specific Place/Plan

After monthly hard limit:
- stop issuing Static Maps URLs for every surface
- API returns `staticMap: null` plus `staticMapStatus.reason = "hard_limit"`
- web Plan detail shows: “Map preview paused. Open in Google Maps.”
```

Local/staging/prod recommendation:

```txt
local:
- use low limits such as daily=2, monthly_soft=3, monthly_hard=4 when testing fallback states

staging:
- keep anonymous maps off
- use low but realistic limits to catch accidental feed overuse

production:
- keep Google Cloud quota/budget alerts enabled
- keep app hard limit below the monthly spend level you are comfortable with
- review Google Cloud API metrics after traffic changes
```

## Provider address smoke before map rollout

Before relying on Static Maps for Place cards, run the address provider smoke checks from `docs/plans/google-provider-smoke-parity.md`. Static Maps should only be issued for local Places/Plan stops that have provider-backed coordinates.

```bash
EXPECT_PLANS_ENABLED=true \
EXPECT_GOOGLE_PLACES_ENABLED=true \
GOOGLE_PLACE_SMOKE_QUERY="Eiffel Tower" \
GOOGLE_PLACE_SMOKE_COUNTRY=FR \
npm run places:address-provider-smoke
```

If this smoke fails, fix the provider-selected address flow before debugging Static Maps. Static Maps must not use manual/free-text-only locations as map sources.

## Local testing checklist

1. Add env variables.
2. Restart API server.
3. Create a local Place using Google place search.
4. Confirm the API response includes `staticMap` for local places.
5. Confirm remote places return `staticMap: null`.
6. Confirm uploaded images still win over static maps.
7. Confirm light theme uses `lightUrl` and dark theme uses `darkUrl`.
8. Confirm anonymous users do not receive map URLs when `GOOGLE_STATIC_MAPS_ANONYMOUS_ENABLED=false`.
9. Lower `GOOGLE_STATIC_MAPS_DAILY_SOFT_LIMIT` to `1` locally and confirm list/preview surfaces stop receiving Static Maps while detail pages still can.
10. Lower `GOOGLE_STATIC_MAPS_MONTHLY_HARD_LIMIT` to `1` locally and confirm web Plan detail shows “Map preview paused. Open in Google Maps.”
11. Check Google Cloud API metrics after testing.

## Troubleshooting

### Static map does not appear

Check:

```txt
GOOGLE_STATIC_MAPS_ENABLED=true
GOOGLE_STATIC_MAPS_API_KEY is set
Maps Static API is enabled
API key is restricted to Maps Static API
HTTP referrer restriction includes your current domain
Place has local mode and either coordinates or a public address
Budget guard has not stopped issuing URLs
If `staticMapStatus.reason` is `soft_limit`, open the detail page instead of a feed/list surface
If `staticMapStatus.reason` is `hard_limit`, open the Google Maps link instead of loading an in-app preview
```

### Place search works but map image fails

Likely cause: using a server/IP restricted key for a browser image request. Use a separate Static Maps key restricted by HTTP referrer.

### Map works locally but not production

Likely cause: production domain missing from HTTP referrer restrictions.

### Costs rise too quickly

Actions:

```txt
Set GOOGLE_STATIC_MAPS_ANONYMOUS_ENABLED=false
Lower GOOGLE_STATIC_MAPS_DAILY_SOFT_LIMIT
Lower GOOGLE_STATIC_MAPS_MONTHLY_SOFT_LIMIT
Lower GOOGLE_STATIC_MAPS_MONTHLY_HARD_LIMIT
Lower Google Cloud Maps Static API daily quota
Reduce where cards request static maps
Prefer uploaded image / fallback visuals in high-traffic anonymous feeds
```

## Future improvements

```txt
- Persist budget counts in DB/Redis instead of process memory.
- Move hard-limit counters to shared storage for multi-instance deployments.
- Add admin dashboard showing static map budget state.
- Add per-user or per-IP static map throttling.
- Add approximate public map mode for sensitive places.
- Add Cloud map IDs for stronger brand styling.
- Add Plus multi-visual Place carousel.
```
