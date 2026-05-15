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

## Not included yet

- Public Plans tab/menu.
- Polished web/native Plan feed or creation UI.
- Maps or route previews.
- Notifications.
- Public chat.
- Paid helpers or money flow.
- Teen/minor mode.
- Full admin Plans management screens.

## Recommended next step

Build hidden web/native Plans screens only when the API foundation is stable:

1. Hidden Plan feed and detail screens.
2. Create Plan form with places.
3. Join request UI.
4. Owner accept/decline UI.
5. Report/support buttons.
6. Admin moderation view for Plans.
