# PLAN-CONFLICT3 smoke: cancelled/deleted Plans do not block time

This checklist verifies that Plan conflict enforcement only considers Plans that still reserve time.

## Product rule

Active Plans reserve time for their owner and keep the 1-hour buffer rule.

Cancelled, hidden, or deleted Plans do not reserve time anymore. A user can create a new Plan that overlaps a cancelled/deleted Plan.

## Blocking statuses

Backend conflict checks should only consider Plans with:

```txt
status in draft/open/full/started
deletedAt == null
```

They should ignore:

```txt
cancelled
hidden / soft-deleted
deletedAt != null
```

## Setup

Use one account with Plans enabled.

Create Plan A:

```txt
Start: 11/07/2026 13:00
End:   11/07/2026 14:00
```

Then try creating Plan B:

```txt
Start: 11/07/2026 14:30
End:   11/07/2026 15:30
```

Because Plan B starts only 30 minutes after Plan A ends, active Plan A should block it.

Expected API result while Plan A is active:

```txt
409 plan_time_overlap
minGapMinutes: 60
```

## Cancelled Plan no longer blocks

1. Cancel Plan A.
2. Create Plan B with the same overlapping/too-close time.

Expected result:

```txt
Plan B is created successfully.
```

Plan A may remain visible as cancelled, but it should not reserve time.

## Deleted Plan no longer blocks

1. Create a fresh Plan A with the same time.
2. Delete Plan A.
3. Create Plan B with the same overlapping/too-close time.

Expected result:

```txt
Plan B is created successfully.
```

Deleted Plan A should be hidden from public feed/detail/search and should not reserve time.

## Still blocked by active Plans

1. Create a fresh Plan A and leave it active/open.
2. Try to create Plan B with the same overlapping/too-close time.

Expected result:

```txt
409 plan_time_overlap
```

This confirms the inactive Plan exception did not weaken the active Plan safety rule.

## Regression checks

- Cancelled Plans still cannot be joined if the join flow blocks non-writable statuses.
- Deleted Plans cannot be opened publicly.
- Deleted Plans are not returned by `/plans/feed`, `/plans/mine`, or `/plans/joined`.
- Draft restore is local-only and does not create server-side conflict records.
