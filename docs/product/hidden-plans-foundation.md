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

A Plan is a joinable activity owned by one user. In the simplified hidden v1, a Plan has one or more ordered places/stops. Each place has its own Local/Remote type plus date/time, and authenticated users can join instantly.

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
- The hidden web UI uses per-place Local/Remote controls. Local places use an address or meeting point; Remote places use an online link or instructions. The older private-address model remains available internally for a later safety/privacy pass.
- Restricted users cannot create plans, add places, upload media, or join.
- Public Plan feed/detail responses hide Plans owned by restricted users.
- Blocked user pairs cannot join each other's Plans.
- Plans should stay connected to reporting, support, hidden-content, and admin moderation before public release.

## Foundation models

- `Plan`: title, description, calculated timing range, category/tags, status, owner, and future participant-limit fields.
- `Place`: reusable library item for future My Places and Hellowhen Place Library surfaces.
- `PlanPlace`: ordered per-Plan snapshot with Local/Remote mode, explicit date/time, name, visible address or online link, notes/purpose, optional media, and optional `placeId` link back to a reusable Place.
- `PlanParticipant`: instant joins and participant lifecycle; pending approval status remains for later use.
- Media can attach to `place`, `plan`, or `plan_place` through `MediaAsset.entityType`, but the simplified hidden web UI only creates Plan Place images.
- Place media reuse the authenticated JPEG/PNG/WEBP upload route. The hidden web UI limits Plan Place images to one image per place for now; shared contracts prepare 1 Free, 5 Plus, and 6 admin/library images for reusable Places.
- Reports can target `plan` and `plan_place`; hiding a reported Plan Place hides its parent Plan from public/internal discovery.

## Current API foundation

When `PLANS_ENABLED=true`, the backend exposes the hidden reusable Place Library API:

- `GET /places/mine`
- `POST /places`
- `GET /places/library`
- `GET /places/:placeId`
- `PATCH /places/:placeId`
- `DELETE /places/:placeId`

It also exposes the hidden Plans API:

- `GET /plans/feed`
- `GET /plans/mine`
- `GET /plans/joined`
- `GET /plans/:planId`
- `POST /plans`
- `PATCH /plans/:planId`
- `POST /plans/:planId/places`
- `PATCH /plans/:planId/places/:placeId`
- `POST /plans/:planId/join`
- `POST /plans/:planId/leave`
- `POST /plans/:planId/join-requests` — compatibility alias for free join
- `GET /plans/:planId/join-requests` — owner/admin review surface kept hidden for now
- `PATCH /plans/:planId/join-requests/:participantId` — compatibility/admin-only owner action
- `PATCH /plans/:planId/my-join-request` — compatibility alias for cancel/leave


## PLAN-PROD3 API cleanup

The first public Plan version uses free join language. Keep owner-approval internals hidden until explicitly revived later.

Preferred v1 endpoints:

- `GET /plans/mine` — plans created by the current user
- `GET /plans/joined` — open/full/started plans the current user has freely joined
- `POST /plans/:planId/join` — free join; immediately creates or restores an accepted participant row
- `POST /plans/:planId/leave` — leave a joined plan

Compatibility routes remain available for older hidden clients, but new UI should prefer the clearer join/leave methods.

## Hidden API smoke test


Run with Plans disabled to confirm the Place Library gate is closed:

```bash
npm run places:smoke
```

Expected result:

```txt
Place Library disabled gate: PASS
```

Run with Plans enabled locally to test the My Places flow:

```bash
EXPECT_PLANS_ENABLED=true npm run places:smoke
```

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

The enabled smoke test logs in the seeded demo users, creates an open simplified Plan with Local and Remote places, verifies public place details, joins instantly as the helper user, edits Plan/place details, adds another Remote place, checks participant leave behavior, and then cancels the test Plan.

## Hidden web UI

When `NEXT_PUBLIC_PLANS_ENABLED=true`, internal testers can open:

- `/plans`
- `/plans/new`
- `/plans/[planId]`
- `/plans/[planId]/edit`

`NEXT_PUBLIC_PLANS_VISIBLE=false` keeps Plans out of primary navigation. These routes are direct internal preview routes only.

The hidden UI currently supports:

- feed vs mine vs joined list
- create Plan with ordered places
- create Plan by choosing reusable My Places
- create Plan by choosing Hellowhen Place Library items
- inline Create My Place action from the create Plan picker
- custom one-off Plan places when no reusable Place is needed
- per-place Local/Remote segmented controls
- per-place date and time
- one image per custom Plan place
- source Place image fallback for reusable Place snapshots when no Plan Place image is attached
- add custom place and add from library actions at the top of the Places section
- Move up / Move down place ordering buttons
- automatic Plan start/end range calculation from ordered place date/time values
- feed deck preview at the end of create/edit forms
- Plan detail view with summary hero, free join/leave actions, joined people, place timeline, and Place images
- owner-only Plan editor at `/plans/[planId]/edit`
- owner edit/cancel lifecycle controls
- report Plan and report Plan Place actions for non-owner viewers
- support link from Plan detail
- instant Join Plan flow with clear `Join Plan` / `Joined` / `Leave Plan` states
- owner remove participant
- participant leave

## PLAN-PROD5 web detail polish

The hidden web detail page now keeps the Plan summary on the detail route instead of the feed deck. The detail route shows:

- a compact back/top bar
- Plan summary hero
- status and joined badges
- free join / leave actions
- owner edit action
- ordered place timeline
- joined people list
- small safety/support block

Public discussion remains postponed. No Trade, Need, Offer, Agenda, payment, or owner-approval connection is added in this patch.


## PLAN-PROD6 web create Plan + Place picker

The hidden web create route now uses the reusable Place foundation instead of only hand-entered Plan places. Internal testers can:

- choose an existing My Place
- choose a Hellowhen Place Library item
- create a private My Place inline from the picker
- keep using custom one-off Plan places
- reorder selected/custom places with Move up / Move down
- set each selected place's Plan-specific date/time
- adjust the snapshot title, public address, online label/URL, and note before publishing

The create flow still saves `PlanPlace` snapshots. Editing a reusable `Place` later must not silently change existing Plans. Source Place media can be used as a fallback for Plan place cards when the Plan place itself has no image.

## Not included yet

- Public Plans tab/menu.
- Maps or route previews.
- Notifications.
- Public chat.
- Paid helpers or money flow.
- Teen/minor mode.
- Full admin Plans management screens.

## Recommended next step

1. Add admin Plan moderation views if Plans need deeper internal review before visibility.
2. Decide whether exact addresses need owner-approval/private visibility again before any public Plans launch.
3. Add optional smoke coverage for media/report flows once a dedicated non-polluting test fixture is available.

## PLAN-PROD7 mobile route skeleton

The native app now has hidden, feature-gated Plan routes wired behind the existing `EXPO_PUBLIC_PLANS_ENABLED` and `EXPO_PUBLIC_PLANS_VISIBLE` flags. This patch does not replace the production bottom navigation, and it does not remove the existing Trade / Needs / Offers / Account tabs.

When the flags are enabled for internal testing, Account can show a Plans entry that opens the native Plan hub. The skeleton includes routes for:

- `Plans`
- `PlanDetail`
- `MyPlans`
- `JoinedPlans`
- `MyPlaces`
- `PlaceLibrary`
- `CreatePlan`
- `CreatePlace`

The native Plan hub can call the hidden Plan and Place Library APIs for feed, mine, joined, My Places, and Hellowhen Place Library lists. Create Plan and Create Place are intentionally placeholder routes until the dedicated mobile create/picker patch. This keeps navigation stable before the mobile deck and full create flow are added.


## PLAN-PROD8 mobile Plan feed deck

The hidden native Plan hub now renders the main open Plans feed as production-style square decks that reuse the same `ContinuousSquareStackDeck` gesture system as the Trade feed.

The native Plan feed rules are:

- keep Plans hidden behind `EXPO_PUBLIC_PLANS_ENABLED` and `EXPO_PUBLIC_PLANS_VISIBLE`
- keep the existing Trade / Needs / Offers / Account tabs unchanged
- keep the Plan header as title + filter icon + list/menu icon + create button
- render open Plans as square decks
- make each deck place-only: Place 1, then Place 2, then Place 3
- do not insert a generated Plan summary card into the feed deck
- keep the Plan summary hero on the detail screen
- keep My Plans and Joined Plans as simple management lists for now

The deck cards can use PlanPlace images or fall back to source reusable Place images when a PlanPlace was created from My Places or the Hellowhen Place Library.

## PLAN-PROD9 mobile Plan detail + join polish

The hidden native Plan detail route now mirrors the polished web detail direction more closely while staying feature-gated and independent from Trade / Needs / Offers / Agenda.

The native detail screen now shows:

- a cleaner Plan summary hero
- Plan / status / joined badges
- owner, date range, and location summary rows
- compact joined / places / free-join stat pills
- owner-specific copy instead of a normal join button
- Join plan for eligible users
- Joined state plus Leave plan for joined users
- ordered route/timeline place cards
- PlanPlace media first, reusable source Place media fallback second
- joined people section
- compact safety/support section
- report actions for Plan and Plan Place when the viewer is not the owner

Public discussion stays postponed and hidden. The first production mobile Plan detail remains a free-join route/timeline view only.

## PLAN-PROD10 mobile Create Plan + Place Library

The hidden native Create Plan and Create Place placeholder routes are now working internal flows.

Native Create Plan now supports:

- loading My Places and Hellowhen Place Library from the hidden Place APIs
- searching reusable Places
- adding reusable My Places as PlanPlace snapshots
- adding Hellowhen Library Places as PlanPlace snapshots
- adding custom one-off Plan places
- inline private My Place creation from the Create Plan flow
- selected-place ordering with up/down controls
- per-place date and time fields
- per-place offline meeting point or online label/URL fields
- per-place Plan note fields
- a place-only preview list that matches the feed rule: Place 1, Place 2, Place 3
- automatic Plan start/end calculation from ordered selected places
- free-join Plan creation with `joinApprovalMode: automatic`

Native Create Place now supports:

- private My Place creation
- offline/online mode selection
- title, category, description, default note
- offline area/address or online label/URL
- save to My Places

This patch keeps Plans hidden behind `EXPO_PUBLIC_PLANS_ENABLED` and `EXPO_PUBLIC_PLANS_VISIBLE`, keeps the existing Trade / Needs / Offers / Account tabs unchanged, and does not add Trade, Need, Offer, Agenda, payment, owner approval, public discussion, or backend matchmaking connections.

## PLAN-NAV1 safe Account/Me exposure

Plans can now be exposed from Account when both visibility flags are enabled:

- Web: `NEXT_PUBLIC_PLANS_ENABLED=true` and `NEXT_PUBLIC_PLANS_VISIBLE=true`
- Native: `EXPO_PUBLIC_PLANS_ENABLED=true` and `EXPO_PUBLIC_PLANS_VISIBLE=true`

This is intentionally Account-first exposure. It does not replace or remove the production Trade / Needs / Offers / Account navigation.

When visible on web, Account shows a Plans workspace section with safe links to existing web routes:

- `Plans` → `/plans`
- `My plans` → `/plans?view=mine`
- `Joined plans` → `/plans?view=joined`
- `Create plan` → `/plans/new`

Standalone web My Places and Hellowhen Place Library pages are still postponed; those concepts remain available inside the web Create Plan picker for now.

When visible on native mobile, Account shows a dedicated Plans section with direct links to the existing hidden native Plan routes:

- Plans
- My plans
- Joined plans
- My places
- Hellowhen Place Library
- Create plan
- Create place

This prepares the future “Me” hub direction without changing the main tabs yet.

## PLAN-NAV2 optional Plans / Me / Trade nav experiment

The production Trade / Needs / Offers / Account navigation remains the default. This patch adds only an optional nav experiment behind a separate public flag:

- Web: `NEXT_PUBLIC_MAIN_NAV_PLANS_ME_TRADE=true`
- Native: `EXPO_PUBLIC_MAIN_NAV_PLANS_ME_TRADE=true`

The experiment only activates when the existing Plan visibility flags are also enabled. This prevents the new navigation from showing a Plans tab while Plans are still hidden.

Experimental nav shape:

- Plans
- Me
- Trade

Safety rules:

- Needs and Offers routes are not deleted.
- Existing create/detail routes for Needs and Offers remain available.
- Account remains the underlying Me destination.
- Trade remains the underlying trade feed destination.
- Plans uses the hidden Plan feed/detail/create routes added in the production Plan patch chain.
- The experiment can be disabled by turning the new nav flag back to `false`.

On native mobile, the tab route names are internal (`PlanTab`, `MeTab`, `TradeTab`) so they do not collide with existing stack routes like `Plans`. On web, the header and bottom tabs switch to a three-tab set while the old web tabs remain the default fallback.

## PLAN-POLISH1 Plan feed scope tab cleanup

The Plans discovery feed is now cleaner and matches the Trade feed direction more closely.

Native mobile Plans no longer shows the inline `Open / My plans / Joined` scope pills on the main feed. The main Plans tab is dedicated to public/open Plan discovery. Personal Plan areas stay available from the Plan menu:

- My plans
- Joined plans
- My places
- Hellowhen Place Library
- Create place
- Create plan

The filter icon is kept for future Plan discovery filters, but it no longer cycles between personal scopes. It now opens a small feed note so the header shape remains stable.

Web Plans mirrors the same direction: the header keeps filter, menu, and create actions, while My plans and Joined plans remain accessible from the menu/query-backed view without showing scope tabs in the feed shell.

## ME-HUB1 auth/home behavior

When the optional `Plans / Me / Trade` mobile navigation experiment is enabled, the tab navigator now opens on the center `Me` tab first while keeping the visual tab order as `Plans / Me / Trade`.

Logged-out users see the existing Hellowhen login/register/reset auth content directly inside `Me` instead of a separate "login required" blocker. Logged-in users continue to see the normal Account/Me hub. This keeps the first app visit focused on identity and onboarding while leaving `Plans` and `Trade` available from the bottom tabs.

## ME-HUB2 widget-based Me hub

When the optional `Plans / Me / Trade` navigation experiment is enabled and the user is logged in, the native `Me` tab now behaves like a personal command center instead of a long account/settings list.

The visible page prioritizes a profile widget and compact widget sections for activity, Plans, and tools. Trade activity, My needs, My offers, Plans, My plans, Joined plans, My places, Saved Library, Agenda, Notifications, and Support can be opened from widget cards.

Heavier account actions are moved into the top-right `Me menu` sheet: settings, legal/safety, account deletion, future tools, onboarding guide, support, and logout. This keeps account/settings controls available while avoiding a settings-dump feeling on the main Me screen.

## ME-HUB3 Me menu polish

The native `Me` hub now keeps its main widget areas collapsible so the page can stay calm as more tools are added. Activity, Plans, and Tools remain expanded by default, but each section can be collapsed from its header.

The top-right `Me menu` sheet is grouped instead of flat:

- Settings & safety
- Help
- Future tools

Logout remains separated at the bottom of the sheet. This keeps the Me hub focused on useful widgets while still making account, safety, support, and future feature entry points reachable from the menu.
