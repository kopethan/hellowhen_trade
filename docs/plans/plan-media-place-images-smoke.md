# PLAN-MEDIA1 — Saved Place image smoke checks

## Purpose

Plans should be able to use saved Places that already have images without asking the user to upload duplicate copies.

Saved Place images remain attached to the reusable Place. Plan Places render those images through the source-place media fallback, so Plan creation must not try to reattach the same media asset to the new Plan Place.

## Native mobile smoke

1. Create or open three saved Places in My Places.
2. Add one image to each saved Place.
3. Open Create Plan.
4. Add the three saved Places to the Plan.
5. Open Preview.
6. Tap Create Plan.

Expected:

- The Plan is created successfully.
- No warning appears saying: “One or more selected images already belong to another item.”
- The created Plan detail still shows Place images where source Place image fallback is available.

## Regression checks

- Creating a Plan from saved Places without images still works.
- Creating a Plan from Hellowhen Library Places still works.
- Existing Place images are not duplicated or re-owned by Plan Places.
- The generic media reuse guard still protects manual image reuse flows outside this saved-Place snapshot path.

## Non-goals

- Do not add Plan-specific image uploads in this patch.
- Do not clone media rows for every Plan Place.
- Do not relax media ownership rules globally.
