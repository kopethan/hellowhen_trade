# PLAN-DRAFT2 — Native Create Plan draft restore validation smoke

## Scope

Validate that an unfinished native Create Plan draft does not silently reuse stale saved Place references.

The draft remains local to the device. On restore, every stop with a saved `sourcePlaceId` is checked against the live Place API before preview or publish. Custom stops continue through the existing address/link validation.

## Setup

1. Use the native mobile app while signed in.
2. Keep Plans enabled with the existing SDK 51 setup.
3. Create at least:
   - one active offline Place with a confirmed provider address;
   - one active online Place with a valid `http://` or `https://` URL;
   - one Place that can be archived or left as a draft.

## Active saved Place refresh

1. Start Create Plan.
2. Add an active saved Place and choose a date/time.
3. Leave Create Plan so the local draft is saved.
4. Update the saved Place title or destination without changing the draft date/time.
5. Return to Create Plan and choose **Continue**.

Expected:

- The app briefly shows **Checking saved Places**.
- The current Place title, destination, image/static-map snapshot, and source type are refreshed.
- The draft stop date/time remains unchanged.
- Preview and publish are available after all normal Plan validations pass.

## Archived, hidden, draft, or missing Place

1. Save a Create Plan draft containing a reusable Place.
2. Before restoring, archive/hide the Place, leave it in draft status, or remove access so `GET /places/:placeId` returns not found.
3. Restore the Create Plan draft.

Expected:

- The affected stop stays visible and is labelled **Needs review**.
- The reason distinguishes an archived, hidden, unfinished, missing/unavailable, or temporarily unconfirmed Place where possible.
- The user can **Check again**, **Change place**, or **Remove** the stop.
- Preview and Create Plan remain disabled while any stop is checking or needs review.

## Invalid reusable Place destination

1. Save a draft with a reusable Place.
2. Make the source Place unusable for new Plans:
   - offline Place without a confirmed Google/provider address; or
   - online Place without a valid HTTP(S) destination.
3. Restore the draft.

Expected:

- The stop is labelled **Needs review**.
- The draft cannot preview or publish until the Place is fixed/replaced, converted to a valid custom stop, or removed.
- Selecting an unfinished/draft Place from **My Places** opens the existing fix flow instead of adding it as a usable stop.

## Retry and connection failure

1. Restore a draft while the API is unreachable.
2. Confirm the referenced saved stops become **Needs review** rather than being trusted from the local snapshot.
3. Restore connectivity and tap **Check again**.

Expected:

- A successful retry refreshes and clears the review state for an active usable Place.
- Replacing or removing the stop while a check is running is not overwritten by the stale response.

## Mixed draft

Restore a draft containing:

- one valid saved Place;
- one unavailable saved Place;
- one custom online or offline stop.

Expected:

- Only the valid saved Place is refreshed automatically.
- Only the unavailable saved Place is highlighted for review.
- The custom stop continues through the existing online URL or confirmed offline address rules.
- Removing the broken stop immediately removes the draft review block.

## Publish race safety

After a draft Place passes restore validation, archive it before pressing **Create Plan**.

Expected:

- The API still rejects the stale `placeId` through the existing active reusable-Place snapshot rule.
- No Plan is created with an archived or inaccessible source Place.
- The local draft remains available because it is cleared only after successful creation.
