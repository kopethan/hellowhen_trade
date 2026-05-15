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

A Plan is a joinable activity owned by one user. In the simplified hidden v1, a Plan has one date and one or more ordered places/stops; authenticated users can join instantly.

Examples:

- Visit a museum with others.
- Explore several places in a city.
- Go hiking with a small group.
- Create a study/work session.
- Find company for a safe, shared activity.

Plans are not money features. Do not add paid helpers, wallet amounts, payouts, or cash coordination to Plans while the first launch remains money-off.

## Safety defaults

- Hellowhen remains 18+ only.
- Simplified hidden v1 uses instant join; owner approval controls remain in the model for later but are not exposed in the hidden web UI.
- The hidden web UI uses one visible place address field for now. The older private-address model remains available internally for a later safety/privacy pass.
- Restricted users cannot create plans, add places, upload media, or join.
- Public Plan feed/detail responses hide Plans owned by restricted users.
- Blocked user pairs cannot join each other's Plans.
- Plans should stay connected to reporting, support, hidden-content, and admin moderation before public release.

## Foundation models

- `Plan`: title, description, calculated timing range, category/tags, location label, status, owner, and future participant-limit fields.
- `PlanPlace`: ordered stops with time, name, visible address, notes/purpose, and optional media.
- `PlanParticipant`: instant joins and participant lifecycle; pending approval status remains for later use.
- Media can attach to `plan` or `plan_place` through `MediaAsset.entityType`, but the simplified hidden web UI only creates Place images.
- Place media reuse the authenticated JPEG/PNG/WEBP upload route. The hidden web UI limits this to one image per place for now.
- Reports can target `plan` and `plan_place`; hiding a reported Plan Place hides its parent Plan from public/internal discovery.

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

The enabled smoke test logs in the seeded demo users, creates an open simplified Plan, verifies public place details, joins instantly as the helper user, edits Plan/place details, adds an overnight place, checks participant leave behavior, and then cancels the test Plan.

## Hidden web UI

When `NEXT_PUBLIC_PLANS_ENABLED=true`, internal testers can open:

- `/plans`
- `/plans/new`
- `/plans/[planId]`
- `/plans/[planId]/edit`

`NEXT_PUBLIC_PLANS_VISIBLE=false` keeps Plans out of primary navigation. These routes are direct internal preview routes only.

The hidden UI currently supports:

- feed vs mine list
- create Plan with a plan-level date and ordered places
- one image per place
- add-place button at the bottom of the Places section
- Move up / Move down place ordering buttons
- automatic Plan start/end range calculation from place times, including next-day rollover when a later place time is earlier than the previous one
- feed deck preview at the end of create/edit forms
- Plan detail view with place timeline and Place images
- owner-only Plan editor at `/plans/[planId]/edit`
- owner edit/cancel lifecycle controls
- report Plan and report Plan Place actions for non-owner viewers
- support link from Plan detail
- instant Join Plan flow
- owner remove participant
- participant leave

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

1. Add admin Plan moderation views if Plans need deeper internal review before visibility.
2. Decide whether exact addresses need owner-approval/private visibility again before any public Plans launch.
3. Add hidden native Plans screens only when explicitly selected.
4. Add optional smoke coverage for media/report flows once a dedicated non-polluting test fixture is available.
