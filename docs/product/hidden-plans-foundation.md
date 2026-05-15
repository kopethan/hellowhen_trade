# Hidden Plans foundation

Plans are a future Hellowhen product surface for joinable activities. They are not part of the first public Trade launch.

## First-launch position

Keep Plans disabled and hidden for the first public launch:

```env
PLANS_ENABLED=false
PLANS_VISIBLE=false
NEXT_PUBLIC_PLANS_ENABLED=false
NEXT_PUBLIC_PLANS_VISIBLE=false
EXPO_PUBLIC_PLANS_ENABLED=false
EXPO_PUBLIC_PLANS_VISIBLE=false
```

`PLANS_ENABLED=false` blocks the backend `/plans` API. `PLANS_VISIBLE=false` keeps web/native UI from showing Plans entry points when later screens are added.

For internal browser testing, use:

```env
PLANS_ENABLED=true
PLANS_VISIBLE=false
NEXT_PUBLIC_PLANS_ENABLED=true
NEXT_PUBLIC_PLANS_VISIBLE=false
```

This keeps Plans out of visible navigation while allowing direct internal routes such as `/plans`.

## Product definition

A Plan is a joinable activity owned by one user. It can have one or more places/stops, and other users can request to join.

Examples:

- Visit a museum with others.
- Explore several places in a city.
- Go hiking with a small group.
- Create a study/work session.
- Find company for a safe, shared activity.

Plans are not money features. Do not add paid helpers, wallet amounts, payouts, or cash coordination to Plans while the first launch remains money-off.

## Safety defaults

- Hellowhen remains 18+ only.
- Owner approval is the default join mode.
- Exact/private place details stay hidden unless the viewer owns the plan or has an accepted participant status.
- Restricted users cannot create plans, add places, or request to join.
- Blocked user pairs cannot request/accept participation.
- Plans should stay connected to reporting, support, hidden-content, and admin moderation before public release.

## Foundation models

- `Plan`: title, description, timing, category/tags, location label, status, owner, participant limits.
- `PlanPlace`: ordered stops with public note/address and optional private address.
- `PlanParticipant`: join requests and participant lifecycle.
- Media can attach to `plan` or `plan_place` through `MediaAsset.entityType`.
- Reports can target `plan` and `plan_place`.

## Current API foundation

When `PLANS_ENABLED=true`, the backend exposes:

- `GET /plans/feed`
- `GET /plans/mine`
- `GET /plans/:planId`
- `POST /plans`
- `PATCH /plans/:planId`
- `POST /plans/:planId/places`
- `PATCH /plans/:planId/places/:placeId`
- `POST /plans/:planId/join-requests`
- `GET /plans/:planId/join-requests`
- `PATCH /plans/:planId/join-requests/:participantId`
- `PATCH /plans/:planId/my-join-request`

## Hidden API smoke test

Run with Plans disabled to confirm the first-launch gate is closed:

```bash
npm run plans:smoke
```

Expected result:

```txt
Plans disabled gate: PASS
```

Run with Plans enabled locally to test the full owner/helper flow. Start the API with `PLANS_ENABLED=true`, then run the smoke script with `EXPECT_PLANS_ENABLED=true`:

```bash
EXPECT_PLANS_ENABLED=true npm run plans:smoke
```

On Windows PowerShell:

```powershell
$env:EXPECT_PLANS_ENABLED="true"
npm run plans:smoke
```

`EXPECT_PLANS_ENABLED=true` tells the script to expect an enabled API. It does not enable the already-running API process by itself.

The enabled smoke test logs in the seeded demo users, creates an open Plan, verifies private place details are hidden from anonymous/non-participants, sends a join request, accepts it as owner, verifies private details become visible to the accepted participant, and then cancels the test Plan.

## Hidden web UI

When `NEXT_PUBLIC_PLANS_ENABLED=true`, internal testers can open:

- `/plans`
- `/plans/new`
- `/plans/[planId]`

`NEXT_PUBLIC_PLANS_VISIBLE=false` keeps Plans out of primary navigation. These routes are direct internal preview routes only.

The hidden UI currently supports:

- feed vs mine list
- create Plan with one place/stop
- Plan detail view
- request to join
- owner accept/decline/remove
- participant cancel/leave
- private place details hidden until accepted

## Not included yet

- Public Plans tab/menu.
- Native Plans screens.
- Maps or route previews.
- Notifications.
- Public chat.
- Paid helpers or money flow.
- Teen/minor mode.
- Full admin Plans management screens.

## Recommended next step

1. Add plan/place media upload and preview to the hidden web UI.
2. Add report/support buttons on Plan detail.
3. Add admin Plan moderation views.
4. Add hidden native Plans screens.
5. Add edit/cancel lifecycle polish and major-change warnings.
