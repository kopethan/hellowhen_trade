# PLAN-LOCK1 smoke checklist — Immutable Plans after creation

Plans are final once created. Users can create a new Plan when places, order, dates, times, or durations need to change.

## Product rule

- Creating a Plan is the only time users choose Plan places/stops.
- After creation, owners cannot add stops.
- After creation, owners cannot edit stop order.
- After creation, owners cannot edit stop date/time/duration.
- After creation, owners cannot replace a stop with another reusable Place.
- After creation, owners cannot change route/place identity details through Plan stop APIs.
- Owners may still cancel the Plan when cancellation is allowed.
- Public discussion, join, leave, participant management, sharing, and presence verification should continue to work according to their existing rules.

## Backend API checks

Use an authenticated active Plan owner.

### 1. Non-cancel Plan update is blocked

Request:

```http
PATCH /plans/:planId
```

Body examples that must be rejected:

```json
{ "title": "Changed title" }
```

```json
{ "startsAt": "2026-07-10T14:00:00.000Z" }
```

Expected:

```json
{
  "error": "plan_locked_after_creation"
}
```

Expected status: `409`.

### 2. Cancel Plan still works

Request:

```http
PATCH /plans/:planId
```

Body:

```json
{ "status": "cancelled" }
```

Expected status: `200`.

Expected result: Plan status becomes `cancelled`.

### 3. Adding a Plan stop is blocked

Request:

```http
POST /plans/:planId/places
```

Body example:

```json
{
  "title": "New stop",
  "mode": "local",
  "formattedAddress": "10 Rue de Rivoli, 75004 Paris, France",
  "latitude": 48.855,
  "longitude": 2.36,
  "startsAt": "2026-07-10T14:00:00.000Z"
}
```

Expected status: `409`.

Expected error: `plan_locked_after_creation`.

### 4. Editing a Plan stop is blocked

Request:

```http
PATCH /plans/:planId/places/:placeId
```

Body examples that must be rejected:

```json
{ "order": 2 }
```

```json
{ "startsAt": "2026-07-10T16:00:00.000Z" }
```

```json
{ "title": "Changed stop" }
```

Expected status: `409`.

Expected error: `plan_locked_after_creation`.

### 5. Deleting/removing a Plan stop is blocked

Request:

```http
DELETE /plans/:planId/places/:placeId
```

Expected status: `409`.

Expected error: `plan_locked_after_creation`.

### 6. Missing Plan or stop keeps normal 404 behavior

- Unknown `planId` should return `404`.
- Unknown `placeId` under a valid owned Plan should return `404`.
- The lock response should only appear after the owned Plan/stop is identified.

## Web checks

- `/plans/:planId` owner action copy says editing places/times is locked after publishing.
- Owner can share the Plan.
- Owner can cancel the Plan.
- Owner cannot reach an editable stop UI from the detail page.
- `/plans/:planId/edit` redirects back to `/plans/:planId`.
- If an old client calls stop add/update/delete APIs, the user-facing error should explain that Plans are locked after creation.

## Native mobile checks

- Plan detail owner action copy says places and times are locked after publishing.
- Owner can share the Plan.
- Owner can cancel the Plan.
- There is no edit stop/order/time action on Plan detail.
- Presence verification still works for eligible offline Plan stops.
- Join/leave still works for non-owners according to existing status rules.

## Reusable Place checks

- A reusable Place used by a Plan reports `usedInPlansCount` to the owner.
- Editing a reusable user Place used by a Plan is blocked unless the request is archive-only.
- Plan stop snapshots keep the original Plan route stable even if a user creates a new reusable Place later.

## Non-goals

- Do not add Plan revision history yet.
- Do not add stop-level edit requests yet.
- Do not add shared rescheduling yet.
- Do not add partial route cloning yet.
- Do not auto-create replacement Plans.
