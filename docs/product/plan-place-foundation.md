# PLAN-PROD1 reusable Place foundation

PLAN-PROD1 keeps the hidden production Plan feature behind the existing Plan flags and adds the data/contracts needed for a future production Place Library.

## Product rule

A reusable `Place` is a library item. A `PlanPlace` is still the snapshot that appears inside a specific Plan.

That means a user can later edit a saved Place without silently changing an already-created Plan.

## Library structure prepared

- `Place.source = user` prepares **My Places**.
- `Place.source = hellowhen_library` prepares **Hellowhen Place Library**.
- `PlanPlace.placeId` optionally links a Plan snapshot back to the reusable Place it came from.
- Existing Plans can continue to use custom embedded Plan places with no reusable Place link.

## Media limits prepared

Shared contracts expose `PLAN_PLACE_MEDIA_LIMITS`:

- Free user Place: `1` image
- Plus user Place: `5` images
- Admin / Hellowhen library Place: `6` images

The media helper now accepts a per-entity `maxImages` option. Existing callers keep the previous default limit of 5 images unless they opt into a different limit.

## First-version boundaries

PLAN-PROD1 does not add visible navigation or production UI.

It does not add:

- public Plan navigation
- mobile Plan screens
- backend connection to Trade / Need / Offer / Agenda
- payment, approval, or owner-approval Plan flows
- public Plan discussion

Those belong in later PLAN-PROD patches. PLAN-PROD2 adds the hidden `/places` API but still does not add visible UI/navigation.
