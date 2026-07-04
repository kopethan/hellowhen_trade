# PLAN-VERIFY1 — Offline place presence verification audit

This audit covers the existing GPS-based presence verification flow for offline Plan places. It is intentionally docs-only. Do not add a new schema before reading this file: the core storage, API route, contracts, and profile counters already exist.

## Product intent

Offline place presence verification is a Plan trust signal. It should mean:

```txt
This member has confirmed their presence at offline Plan places.
```

It must not mean:

```txt
This member is identity verified.
This member was verified by Hellowhen staff.
This exact location history is public.
```

Public profile copy should use words like:

```txt
Offline place confirmations
Plans attended with GPS confirmation
Presence confirmations
```

Avoid using the standalone word `verified` as if it were identity verification.

## Current storage status

The repo already has `PlacePresenceVerification` in Prisma.

Stored fields include:

```txt
userId
planId
planPlaceId
sourcePlaceId
source = device_gps
status = verified | rejected
latitudeRounded
longitudeRounded
accuracyMeters
distanceMeters
maxDistanceMeters
rejectionReason
verifiedAt
createdAt
```

Important privacy detail:

```txt
The API rounds submitted coordinates before storage.
```

The model is already indexed for:

```txt
user/status/verifiedAt
user/createdAt
user/status/createdAt
plan/place/status/verifiedAt
planPlace/user/status/verifiedAt
sourcePlace/status/verifiedAt
createdAt
```

So `PLAN-VERIFY2` does not need to add a new verification model unless we want a separate user-facing history model later.

## Current API status

The API already exposes:

```txt
POST /plans/:planId/places/:placeId/verify-presence
GET  /plans/place-verifications/summary
```

The verify endpoint:

```txt
- requires auth
- requires active account
- is feature-flagged by PLACE_PRESENCE_VERIFICATION_ENABLED
- only accepts local/offline Plan places
- requires the Plan place or source Place to have coordinates
- allows the Plan owner or an accepted participant
- rejects users blocked by the Plan owner
- ignores Plans owned by restricted users
- only works for Plan statuses: open, full, started
```

The request contract already accepts:

```txt
latitude
longitude
accuracyMeters
locationCapturedAt
isMockedLocation
platform = web | mobile_web | ios | android | unknown
```

The response contract already returns:

```txt
verification
accepted
alreadyVerified
distanceMeters
maxDistanceMeters
```

The authenticated summary endpoint already returns:

```txt
verifiedPlacesCount
verifiedPlansCount
totalVerifiedCheckIns
lastVerifiedAt
```

## Anti-abuse and safety checks already present

The current API already has these controls:

```txt
Rate limit: 20 verification attempts per minute.
Distance gate: PLACE_PRESENCE_MAX_DISTANCE_METERS, default 100m.
Accuracy gate: PLACE_PRESENCE_MAX_ACCURACY_METERS, default 75m.
Same-place cooldown: PLACE_PRESENCE_VERIFICATION_COOLDOWN_HOURS, default 24h.
Global attempt cooldown: PLACE_PRESENCE_MIN_SECONDS_BETWEEN_ATTEMPTS, default 20s.
Daily attempts limit: PLACE_PRESENCE_MAX_DAILY_ATTEMPTS, default 30.
Daily rejected attempts limit: PLACE_PRESENCE_MAX_DAILY_REJECTED_ATTEMPTS, default 8.
Mock location rejection: PLACE_PRESENCE_REJECT_MOCKED_LOCATION, default true.
Stale location rejection: PLACE_PRESENCE_MAX_LOCATION_AGE_SECONDS, default 120s.
Future timestamp rejection: PLACE_PRESENCE_MAX_FUTURE_LOCATION_SECONDS, default 30s.
Suspicious travel speed rejection: PLACE_PRESENCE_MAX_TRAVEL_SPEED_KPH, default 900kph.
```

Known rejection reasons include:

```txt
gps_accuracy_too_low
too_far_from_place
mock_location_detected
location_timestamp_stale
location_timestamp_future
suspicious_location_jump
```

## Current web and native UI status

Plan detail already renders a GPS/presence verification block for offline places.

Web:

```txt
apps/web/src/features/plans/PlanDetailClient.tsx
```

Native:

```txt
apps/mobile/src/features/plans/PlansScreens.tsx
```

Both clients:

```txt
- require auth before attempting verification
- require owner or accepted participant state before attempting verification
- require coordinates on the offline place
- show success/error notices from the verification response
```

Native uses Expo Location and passes:

```txt
latitude
longitude
accuracyMeters
locationCapturedAt
isMockedLocation
platform = ios | android | unknown
```

Web uses browser geolocation and passes:

```txt
latitude
longitude
accuracyMeters
locationCapturedAt
platform = web | mobile_web
```

## Important web blocker found — fixed by PLAN-VERIFY2

The web app previously sent this security header:

```txt
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

That blocked browser geolocation for the whole web app. `PLAN-VERIFY2` changes the policy to allow geolocation for the app itself while keeping camera, microphone, and payment disabled:

```txt
camera=(), microphone=(), geolocation=(self), payment=()
```

Native verification is not affected by this header.

## Current public profile status

Public profile API already computes presence trust counters from verified records.

The public profile response includes these aggregate presence fields:

```txt
verifiedOfflinePlacesCount
verifiedOfflinePlansCount
verifiedOfflineCheckInsCount
lastOfflinePresenceConfirmedAt
```

The web and native profile UIs now show:

```txt
member since
offline place confirmations
plans with confirmed presence
presence check-ins
last presence confirmation date, when available
```

Important current privacy filter:

```txt
Public profile counters count verified offline checks from non-owned active/public-ish Plans only.
```

The current public profile stats do not expose:

```txt
exact place names
exact Plan titles
exact addresses
verification coordinates
```

This is good for privacy. If we show a date later, it should be a safe aggregate such as:

```txt
Last presence confirmed: Jun 2026
```

or:

```txt
Last confirmed: 2 weeks ago
```

Do not expose a public exact address history in v1.

## Environment status

The env variables are already documented in `.env.example`:

```env
PLACE_PRESENCE_VERIFICATION_ENABLED=false
PLACE_PRESENCE_MAX_DISTANCE_METERS=100
PLACE_PRESENCE_MAX_ACCURACY_METERS=75
PLACE_PRESENCE_VERIFICATION_COOLDOWN_HOURS=24
PLACE_PRESENCE_MIN_SECONDS_BETWEEN_ATTEMPTS=20
PLACE_PRESENCE_MAX_DAILY_ATTEMPTS=30
PLACE_PRESENCE_MAX_DAILY_REJECTED_ATTEMPTS=8
PLACE_PRESENCE_REJECT_MOCKED_LOCATION=true
PLACE_PRESENCE_MAX_LOCATION_AGE_SECONDS=120
PLACE_PRESENCE_MAX_FUTURE_LOCATION_SECONDS=30
PLACE_PRESENCE_MAX_TRAVEL_SPEED_KPH=900
```

Keep `PLACE_PRESENCE_VERIFICATION_ENABLED=false` until the UI copy, web geolocation header, and profile trust wording are polished.

## Gaps to fix next

### Gap 1 — Web geolocation header — fixed by PLAN-VERIFY2

Web verification UI exists, and the global Permissions-Policy now allows geolocation for `self`.

### Gap 2 — Profile trust wording — fixed by PLAN-VERIFY2

The profile panels explain that these are offline presence confirmations, not identity verification.

User-facing labels now use:

```txt
Offline place confirmations
Plans with confirmed presence
Presence check-ins
```

### Gap 3 — Last confirmation date — fixed by PLAN-VERIFY2

Public profiles now expose `lastOfflinePresenceConfirmedAt` as an aggregate date only. Exact place names, Plan titles, addresses, and coordinates stay private.

### Gap 4 — Owner self-checks vs trust signal

The public profile query currently avoids counting records from Plans owned by the same user. Keep this rule for public trust counters because self-created Plan confirmations are weaker as a trust signal.

The private `/plans/place-verifications/summary` endpoint can keep counting all of the user’s successful check-ins.

### Gap 5 — Admin/private review

The system stores rejected attempts and rejection reasons, but there is no dedicated admin review screen for suspicious location behavior yet.

Do not add public rejection history. Keep this private/admin-only.

## Updated implementation plan

### PLAN-VERIFY2 — Web geolocation + profile trust polish — implemented

Scope completed:

```txt
- Changed web Permissions-Policy to allow geolocation for self.
- Updated profile trust copy to say offline presence confirmations.
- Shows total presence check-ins.
- Adds public-safe lastOfflinePresenceConfirmedAt to public profile stats.
- Displays last confirmation as aggregate date copy.
- No schema migration required.
```

### PLAN-VERIFY3 — Profile trust counters — implemented

Scope completed:

```txt
- Adds a compact offline presence counter to the public profile hero when the member has confirmed offline presence.
- Adds an emphasized profile trust counter summary above the detailed trust stat grid.
- Keeps the detailed aggregate counters from PLAN-VERIFY2.
- Keeps exact place names, Plan titles, addresses, and coordinates private.
```

### PLAN-VERIFY4 — Verification history privacy/admin — implemented

Scope completed:

```txt
- Adds a private authenticated verification history endpoint:
  GET /plans/place-verifications/mine

- Adds admin-only verification review endpoints:
  GET   /admin/place-verifications
  GET   /admin/place-verifications/:verificationId
  PATCH /admin/place-verifications/:verificationId/action

- Adds an admin Plans page section for Plan-level presence checks.
- Admins can filter verified/rejected checks and write a mark-reviewed audit entry.
- Public profiles still expose only aggregate counters and last confirmation date.
- Exact rounded coordinates, rejection reasons, Plan/place details, and review notes stay private/admin-only.
- No database migration is required; mark-reviewed is stored in AdminAuditLog.
```

### PLAN-VERIFY5 — Verification smoke checks

Scope:

```txt
- Add an API smoke script for disabled flag, invalid participant, too-far location, and near-location success.
- Add docs for local testing with PLACE_PRESENCE_VERIFICATION_ENABLED=true.
- Keep smoke records archived/cleaned if created in development.
```

## Recommended next command

```txt
Go PLAN-VERIFY5 — Verification smoke checks
```
