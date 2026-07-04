# PLAN-TIME1 — Plan place duration / end-time audit

## Goal

Audit how Plan and Plan Place start/end times work today before adding automatic final-stop duration estimation.

The product goal is to support this flow:

```txt
Place 1 starts 07:00
Place 2 starts 12:00
Place 3 starts 16:00
Place 4 starts 21:00
```

When the last place has no explicit end time, the app should estimate the final duration from the previous gaps. With those exact times, the gaps are:

```txt
07:00 → 12:00 = 5h
12:00 → 16:00 = 4h
16:00 → 21:00 = 5h
Average = 4h40
```

So the precise estimated final end would be:

```txt
21:00 + 4h40 = 01:40 next day
```

If we use friendlier rounding, the app can round the average to the nearest 30 minutes or hour. The preferred product rule is nearest 30 minutes, because it avoids over-stretching short Plans while still feeling simple.

---

## Current data model

### Plan

`Plan` stores a top-level range:

```txt
startsAt DateTime
endsAt   DateTime?
```

This is already enough to store the visible Plan range and support overlap checks.

### PlanPlace

`PlanPlace` already stores per-stop timing:

```txt
startsAt DateTime?
endsAt   DateTime?
```

This means no migration is required for a first implementation of estimated stop end times. The database can already hold the final stop end time, and it can also hold future per-place end times if we decide to expose them.

---

## Current API behavior

### Create Plan

`createPlanRequestSchema` accepts:

```txt
startsAt required
endsAt optional
places[].startsAt optional
places[].endsAt optional
```

API creation stores:

```txt
Plan.startsAt = input.startsAt
Plan.endsAt   = input.endsAt ?? null
PlanPlace.startsAt = input.places[].startsAt ?? null
PlanPlace.endsAt   = input.places[].endsAt ?? null
```

### Update Plan

`updatePlanRequestSchema` allows updating the top-level Plan range.

### Create/Update PlanPlace

`createPlanPlaceRequestSchema` and `updatePlanPlaceRequestSchema` already accept `endsAt` for each PlanPlace. The route helpers store `PlanPlace.endsAt` when provided.

### Overlap detection

The API checks active owned Plans for time overlap using:

```txt
new Plan startsAt <= existing Plan endsAt
and existing Plan endsAt >= new Plan startsAt
```

If a Plan has no `endsAt`, the overlap helper treats the Plan as ending at its start time. That means accurate top-level `Plan.endsAt` matters for preventing overlapping Plans.

---

## Current web behavior

### Shared schedule helper

Web create/edit uses `apps/web/src/features/plans/planSchedule.ts`.

`buildPlanSchedule()` currently:

```txt
- requires at least one place
- parses every place date/time
- requires each place time to be >= the previous place time
- returns Plan.startsAt = first place start
- returns Plan.endsAt = last place start
- returns places[].startsAt
```

It does **not** estimate a final stop duration.

### Web Create Plan

Web Create Plan currently has a separate required “Plan end time” block.

Important behavior:

```txt
- schedule.endsAt is only the last place start time
- explicit Plan end time is required before submit
- submit sends Plan.endsAt = explicit Plan end time
- submit sends places[].startsAt
- submit does not send places[].endsAt
```

So web prevents missing Plan end times by asking the user, but it does not help them estimate the value.

### Web Edit Plan

Web Edit Plan uses `buildPlanSchedule()` and currently saves:

```txt
Plan.endsAt = nextSchedule.endsAt || nextSchedule.startsAt
```

Because `buildPlanSchedule()` returns the last place start as `endsAt`, editing can collapse the Plan range to the final stop start instead of the real final stop end. It also sends `places[].startsAt`, but not `places[].endsAt`.

### Web Detail

Web Plan Detail displays place range with:

```txt
place.startsAt ?? plan.startsAt
place.endsAt if present
```

Since create/edit does not currently populate `PlanPlace.endsAt`, place end labels usually stay empty.

---

## Current native mobile behavior

Native mobile has a local copy of the same schedule logic inside `apps/mobile/src/features/plans/PlansScreens.tsx`.

`buildMobilePlanSchedule()` currently:

```txt
- requires at least one place
- parses every place date/time
- requires each place time to be >= previous place time
- returns Plan.startsAt = first place start
- returns Plan.endsAt = last place start
- returns places[].startsAt
```

### Native Create Plan

Native create has an optional Plan end time state.

Submit currently sends:

```txt
endsAt = explicitPlanEnd.endsAt || schedule.endsAt || schedule.startsAt
```

So if the user does not manually set an end time, native uses the last place start time as the Plan end. It does not estimate the final stop duration.

Native also sends `places[].startsAt`, but not `places[].endsAt`.

---

## Current contract behavior

Contracts already validate:

```txt
Plan.endsAt >= Plan.startsAt
PlanPlace.endsAt >= PlanPlace.startsAt
```

No schema migration is required for estimated end-time v1.

---

## Product issue

The current behavior treats the last place start time as the Plan end fallback. For multi-stop offline Plans, that underestimates duration.

Example:

```txt
07:00 Place 1
12:00 Place 2
16:00 Place 3
21:00 Place 4
```

Current fallback:

```txt
Plan starts 07:00
Plan ends 21:00
```

Better fallback:

```txt
Average previous gap = 4h40
Estimated final stop end = 01:40 next day
Plan ends 01:40 next day
```

Rounded UX option:

```txt
Nearest 30 minutes: 01:30 next day
Nearest hour:       02:00 next day
```

Recommended: nearest 30 minutes.

---

## Recommended algorithm

Add a shared helper that accepts sorted place start times and returns an estimated end time.

Rules:

```txt
1. Use place start times in itinerary order.
2. Ignore places without valid startsAt.
3. If 2+ place starts exist:
   - calculate gaps between consecutive start times
   - average the positive gaps
   - round to nearest 30 minutes
   - add the rounded average to the last place start
4. If exactly 1 place start exists:
   - use a default fallback duration, probably 60 or 90 minutes
5. If the user manually enters an end time:
   - preserve the user value
   - do not auto-overwrite it
6. Never estimate an end earlier than the last place start.
7. Support next-day rollover naturally through Date math.
```

Recommended constants:

```txt
DEFAULT_SINGLE_PLACE_DURATION_MINUTES = 90
MIN_ESTIMATED_PLACE_DURATION_MINUTES = 30
MAX_ESTIMATED_PLACE_DURATION_MINUTES = 8 * 60
ROUND_TO_MINUTES = 30
```

The max cap prevents one very large gap from creating an unrealistic final stop duration.

---

## Recommended UX

### Create Plan

For web and native:

```txt
Plan end time
Estimated from your place times
[Jul 7, 01:30]

You can edit this if the final stop is shorter or longer.
```

Recommended behavior:

```txt
- Auto-fill estimated end when the user has not manually edited the end.
- Once user edits the end, set a manual override flag.
- Provide “Reset to estimated” action.
```

### Preview

Show clear copy:

```txt
Estimated end: 01:30 tomorrow
Based on the average time between your places.
```

### Detail

If we store `PlanPlace.endsAt` for the final place later, detail can show:

```txt
Place 4
21:00 → 01:30 tomorrow · estimated
```

Do not show this as guaranteed. Use “estimated” copy when the app generated it.

---

## Implementation options

### Option A — Top-level Plan end only

Low risk.

```txt
- Keep places[].endsAt empty
- Estimate only Plan.endsAt
- Use existing Plan.endsAt display/overlap logic
```

Pros:

```txt
- no migration
- minimal API changes
- fixes overlap and visible Plan range
```

Cons:

```txt
- Plan Detail cannot show final place end range unless it infers it from Plan.endsAt
```

### Option B — Store final PlanPlace.endsAt too

Still no migration because field already exists.

```txt
- Estimate Plan.endsAt
- Also send places[last].endsAt = estimated end
```

Pros:

```txt
- Plan Detail can show final stop range directly
- Better future support for per-stop durations
```

Cons:

```txt
- Need careful UI copy so users know it is estimated
- There is no existing isEstimated flag in schema
```

### Option C — Add estimated/manual metadata

Most complete, but requires migration.

```txt
Plan.endTimeSource = manual | estimated
PlanPlace.endTimeSource = manual | estimated
```

Not recommended for immediate patch unless we decide this distinction must be stored permanently.

---

## Recommendation

Use Option A first, then optionally Option B if display needs it.

Immediate implementation should:

```txt
- create one shared helper in packages/shared
- use it from web create/edit and native create
- estimate the top-level Plan.endsAt when no manual end is present
- keep manual override behavior
- label the value as estimated in UI
```

Avoid schema migration for now.

---

## Proposed patch split

### PLAN-TIME2 — Shared estimated Plan end helper

Scope:

```txt
- Add shared helper in packages/shared
- Export constants/types
- Cover average-gap calculation
- Cover next-day rollover
- Cover single-place fallback
- Cover rounding/caps
- Add lightweight unit-style smoke script if the repo has a suitable test pattern
```

### PLAN-TIME3 — Web create/edit auto-estimated end time

Scope:

```txt
- Web Create Plan uses estimated end when manual end is untouched
- Web Create Plan shows estimated label/copy
- Web Edit Plan avoids collapsing end to last place start
- Add “Reset to estimated” action if manual end exists
```

### PLAN-TIME4 — Native create auto-estimated end time

Scope:

```txt
- Native Create Plan uses the same shared helper
- Native UI shows estimated end copy
- Preserve manual override
- Avoid fallback to last place start
```

### PLAN-TIME5 — Detail/preview display polish

Scope:

```txt
- Web/native preview labels estimated Plan end clearly
- Plan Detail shows a friendly final range
- Optional: infer final place range from Plan.endsAt for display only
```

---

## Out of scope for this audit

```txt
- Google route duration / travel time calculation
- Calendar/Agenda sync
- shared multi-user scheduling
- per-place editable durations for every stop
- migration for end-time source metadata
```

Those can come later after the simple average-gap rule is working.

---

## PLAN-TIME2 implementation notes

`PLAN-TIME2` adds the first shared end-time helper without a schema migration.

Implemented helper:

```txt
packages/shared/src/planSchedule.ts
packages/shared/src/planSchedule.js
```

Exports:

```txt
estimateFinalPlanPlaceEndTime()
buildEstimatedPlanPlaceEndTimes()
PLAN_ESTIMATED_FINAL_PLACE_END_ROUNDING_MINUTES = 30
PLAN_ESTIMATED_FINAL_PLACE_MIN_DURATION_MINUTES = 30
PLAN_ESTIMATED_FINAL_PLACE_MAX_DURATION_MINUTES = 480
PLAN_ESTIMATED_SINGLE_PLACE_DURATION_MINUTES = 90
```

Current behavior:

```txt
- 2+ valid place starts:
  calculate consecutive gaps, average them, round to nearest 30 minutes,
  cap the estimated final stop duration at 8 hours, and add it to the final start.

- 1 valid place start:
  use a 90-minute default final stop duration.

- invalid/missing starts:
  ignored by the shared estimator.
```

Example:

```txt
07:00 → 12:00 = 5h
12:00 → 16:00 = 4h
16:00 → 21:00 = 5h
Average = 4h40
Rounded to nearest 30 minutes = 4h30
Estimated final end = 01:30 next day
```

Wired behavior:

```txt
- Web Create Plan uses the shared helper inside buildPlanSchedule().
- Web Create Plan no longer requires a manual Plan end time when an estimate exists.
- Web Create Plan sends places[].endsAt for calculated per-stop windows.
- Web Edit Plan no longer collapses Plan.endsAt to the final place start.
- Web Edit Plan sends places[].endsAt.
- Native Create Plan uses the shared helper inside buildMobilePlanSchedule().
- Native preview and submit use the estimated final end when no manual override exists.
- Native Create Plan sends places[].endsAt.
- API Create Plan estimates Plan.endsAt when clients omit it.
- API Create Plan also estimates PlanPlace.endsAt for bulk-created places when clients omit it.
```

Manual override rule:

```txt
If the user provides a Plan end time, the client still sends that manual Plan end.
The shared estimate is only a fallback.
```

Known limitation:

```txt
There is still no endTimeSource field, so the database cannot permanently say
whether a Plan/PlanPlace end was manual or estimated. UI copy in PLAN-TIME3 can
label currently calculated values as estimated during create/edit, but persisted
rows only store the final timestamp.
```

---

## PLAN-TIME3 implementation notes

`PLAN-TIME3` adds visible create/edit UI for the estimated Plan end and manual override flow.

Web Create Plan now shows:

```txt
Plan end time
Optional manual fields
Estimated end / Manual end summary
Use estimate action when a manual end is active
```

Web Create Plan preview also shows the end source and the final timestamp before publish.

Web Edit Plan now exposes the saved Plan end time as editable fields. This keeps the current saved range stable by default, while still allowing the owner to clear the fields and return to the automatic estimate from the place times.

Native Create Plan now mirrors the same behavior:

```txt
End time
Leave empty to use the estimated end from your place times.
Estimated end / Manual end summary
Use estimate action when a manual end is active
```

Preview labels now distinguish:

```txt
Estimated end
Manual end
```

Privacy/data note:

```txt
No schema migration was added.
The database still stores only timestamps, not endTimeSource metadata.
The UI can label the value during create/edit based on whether the current form has a manual override.
```
