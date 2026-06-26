# PLAN-PROD2 Place Library API

PLAN-PROD2 adds the hidden, feature-gated API surface for reusable Places. It does not add visible navigation or production UI.

## Feature gate

The `/places` API uses the existing Plans backend gate:

```env
PLANS_ENABLED=false
```

When `PLANS_ENABLED=false`, `/places/*` returns the same hidden-launch 404 style as `/plans/*`.

## API surface

When `PLANS_ENABLED=true`, the backend exposes:

- `GET /places/mine`
- `POST /places`
- `GET /places/library`
- `GET /places/:placeId`
- `PATCH /places/:placeId`
- `DELETE /places/:placeId`

## Product rules

### My Places

`GET /places/mine` is authenticated and owner-only. It returns reusable user Places where:

- `source = user`
- `ownerId = current user`
- default statuses are `draft` and `active`

Users can create, update, and archive their own Places. Archived Places stay available as historical references for existing `PlanPlace` snapshots, but they stop appearing in default My Places lists.

### Hellowhen Place Library

`GET /places/library` is public/auth optional and returns active library Places where:

- `source = hellowhen_library`
- `visibility = library`
- `status = active`

Only admins can create or update `hellowhen_library` Places. Normal users cannot create library Places or set `visibility = library` on their own Places.

### Place detail privacy

`GET /places/:placeId` can show:

- owner-owned private Places to the owner
- public active user Places
- active Hellowhen library Places

Private address text and default meeting instructions are returned only to the owner or an admin. Anonymous/public readers see public-safe fields.

## Media limits

The API enforces the limits prepared by PLAN-PROD1:

- Free user Place: 1 image
- Plus/Pro user Place: 5 images
- Admin/Hellowhen library Place: 6 images

The limit is enforced server-side when media IDs are attached to a Place.

## First-version boundaries

PLAN-PROD2 does not add:

- Plan feed UI changes
- Place picker UI
- mobile Plan screens
- visible Plan navigation
- maps/geocoding
- Trade / Need / Offer / Agenda integration
- public discussion
