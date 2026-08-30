# PLACE-LIB3 Hellowhen popular Places seed

PLACE-LIB3 adds the first curated Hellowhen Place Library content pack without creating fake users or copying library Places into user inventories.

## Initial pack

The first pack is `paris-popular-v1`. It contains a focused set of recognizable Paris landmarks, museums, gardens, squares, parks, and cultural venues. Every entry has English source copy plus French and Spanish display translations.

The curated definitions intentionally store search queries rather than hard-coded Google Place IDs or coordinates. The seed command resolves each entry against Google Places at the moment it is applied, verifies the prediction against expected name tokens, then stores the provider-confirmed Place metadata required by the existing offline Place address policy.

## Safety rules

- Library Places use `source = hellowhen_library`, `visibility = library`, `status = active`, and `ownerId = null`.
- The seed never creates a user or pretends a Place was user-created.
- The seed is idempotent: it updates an existing library Place when the same Google Place ID or English library title already exists.
- The seed never archives extra library Places that an admin may have added separately.
- A failed or ambiguous Google prediction never silently accepts the first result. The seed records that entry as failed, continues with the remaining curated Places, and exits non-zero after the batch so the failed keys are visible.
- Production writes require an explicit `HELLOWHEN_PLACE_LIBRARY_ALLOW_PRODUCTION=true` guard.
- The default command is a dry run and makes no provider requests or database writes.

## Commands

Preview the pack without network or database changes:

```bash
npm run places:library-seed
```

Resolve all entries through Google Places and upsert them:

```bash
npm run places:library-seed -- --apply
```

Resolve only selected entries while testing:

```bash
npm run places:library-seed -- --apply --only=eiffel-tower,louvre-museum
```

The apply command requires `GOOGLE_MAPS_SERVER_API_KEY` (or the existing `GOOGLE_PLACES_SERVER_API_KEY` fallback). On production, also set `HELLOWHEN_PLACE_LIBRARY_ALLOW_PRODUCTION=true` for the intended run and unset it afterward.

## Future packs

Add future cities as separate reviewed packs rather than turning this into an uncontrolled global directory. The Hellowhen Places UI can keep using the existing search and contextual filters while the curated content grows city by city.
