# Phase 24.0 — Admin area audit and safer launch-admin foundation

## Audit findings

The repo already had a partial admin surface before this phase:

- API admin guard under `/admin/*` using authenticated user role checks.
- Optional admin 2FA enforcement through `ADMIN_REQUIRE_TWO_FACTOR`.
- Admin routes for users/trust tiers, media moderation, support tickets, disputed trades, payouts, money diagnostics, business profiles, and credit purchases.
- Web utility pages under `/admin/support`, `/admin/media`, `/admin/disputes`, `/admin/payouts`, `/admin/money`, and `/admin/credits`.
- Launch limits already use `trustTier`, and the `restricted` tier is already the safest first-launch account restriction mechanism.

Main gaps found:

- No central `/admin` entry page.
- No single launch-health endpoint for support queues, disputes, users, media, and money feature state.
- No general admin audit log except payout-specific events.
- User list did not expose activity counts or basic search/filtering.
- Admin trust-tier changes were not written to a general audit log.
- Media/support/dispute actions did not create a central admin audit entry.

## Implemented in this phase

### Backend

Added a general `AdminAuditLog` model and migration.

The audit log stores:

- admin user id
- action
- target type
- target id
- reason/note
- previous value
- next value
- metadata
- timestamp

Added new admin endpoints:

- `GET /admin/overview`
- `GET /admin/audit-log`

Expanded `GET /admin/users` with:

- search query support
- role filter
- trust tier filter
- activity counts for needs/offers/trades/support/media
- launch limits per user

Added audit logging for:

- user trust-tier changes
- trade dispute resolution actions
- media moderation status changes
- support ticket status/priority updates
- support public replies/internal notes

### Web

Added central admin page:

- `/admin`

The page includes:

- admin login/token bootstrap for local/dev admin work
- launch summary cards
- money feature visibility status
- user search and filters
- selected user trust-tier control
- public profile link for selected user
- safety queue links
- recent support queue preview
- recent admin audit log preview

## Launch safety decisions

For first launch, this phase intentionally uses `trustTier = restricted` as the safe suspension path instead of adding hard-delete behavior.

The admin copy reminds operators:

- do not delete users for launch moderation
- restrict first
- add an internal note
- review support/media/trade history before reinstating

Money admin pages remain gated by existing feature flags. This phase does not enable wallet, payouts, provider transfers, Stripe, or Airwallex.

## Not included yet

This phase does not add:

- moderator/support roles
- advanced permissions
- report queue as a separate table
- hide/restore trade/need/offer actions
- admin notes per user/content outside audit log entries
- full content moderation page
- admin 2FA setup UI
- production-grade admin session handling

## Recommended next phases

### Phase 24.1 — Admin user and content moderation actions

- user detail page
- restrict/restore user with required note
- hide/restore trades, needs, and offers
- close content with admin reason
- show linked reports/support tickets
- audit every sensitive action

### Phase 24.2 — Report queue foundation

- normalized report model
- report profile/trade/need/offer/media
- admin report queue
- resolve/dismiss reports
- link reports to moderation actions

### Phase 24.3 — Support admin polish

- support ticket detail route
- status/priority filters
- internal note UX
- linked target previews
- attachment preview polish

### Phase 24.4 — Admin smoke test and safety pass

- non-admin access blocked
- 2FA requirement respected
- restricted users blocked from sensitive actions
- hidden/removed media disappears publicly
- audit log records all admin actions
