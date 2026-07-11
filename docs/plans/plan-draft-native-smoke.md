# PLAN-DRAFT1 — Native Create Plan draft restore smoke

## Scope

Native mobile only. This checks that unfinished Create Plan work is saved locally on the device before publish and cleared after publish.

## Product rules

- Drafts are private to the current device.
- Drafts are local-only; no backend draft rows are created.
- Drafts apply only before Plan creation.
- Published Plans remain immutable.
- Drafts expire automatically after 7 days.
- Draft storage must not include auth tokens, raw API responses, or image blobs.

## Smoke checks

### 1. Restore selected Places

1. Open Create Plan.
2. Add one or more Places.
3. Change the date/time for at least one stop.
4. Leave Create Plan with the back button.
5. Reopen Create Plan.
6. Confirm the `Continue draft?` sheet appears.
7. Tap `Continue`.

Expected:

- The selected Places are restored.
- The selected stop date/time values are restored.
- The automatic estimated end time is recalculated from the restored stops.
- No Plan is created until the user publishes.

### 2. Start new instead of restoring

1. Create an unfinished Plan draft.
2. Leave and reopen Create Plan.
3. On `Continue draft?`, tap `Start new`.

Expected:

- The draft is cleared from this device.
- Create Plan opens empty.
- Reopening Create Plan again does not show the same old prompt.

### 3. Clear draft from create menu

1. Open Create Plan.
2. Add a Place and change its time.
3. Tap the three-dot Create Plan menu.
4. Tap `Clear draft`.
5. Confirm with `Clear draft`.

Expected:

- Current create state resets to empty.
- Local draft is removed.
- Reopening Create Plan does not restore the cleared draft.

### 4. Draft survives Create Place return

1. Open Create Plan.
2. Add a saved Place.
3. Open a flow that returns to Create Plan, such as creating or fixing a Place.
4. Return to Create Plan.

Expected:

- Existing Create Plan state is still available.
- The returned Place can be added or updated in the draft flow.
- No duplicate draft prompt blocks the return action.

### 5. Publish clears draft

1. Restore or create a draft with valid Places.
2. Preview and publish the Plan.
3. Navigate back to Create Plan.

Expected:

- No old `Continue draft?` prompt appears.
- The newly published Plan is visible normally.
- The published Plan cannot be edited after creation.

### 6. Starter Plan idea behavior

1. Open a starter Plan idea.
2. Tap Create Plan from the idea.
3. Confirm the idea loads directly instead of restoring an unrelated old draft.

Expected:

- Starter idea stops load as prompts.
- The old local draft does not override the starter idea.
- After editing the starter idea stops, the new draft can autosave normally.
