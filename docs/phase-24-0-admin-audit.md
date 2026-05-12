# Phase 24.0 — Admin area audit and safer launch-admin foundation

## Goal

Prepare Hellowhen Trade for a safer first launch by auditing the current admin surface and adding a small admin overview foundation without building a large enterprise console.

The first launch admin direction remains moderation-first:

- users
- trades
- needs
- offers
- profiles/media
- support
- disputes/reports
- basic audit notes/history

Money administration stays hidden unless money feature flags are intentionally enabled.

## Current audit findings

### Already present

- Backend `/admin` routes are protected by auth and admin role checks.
- Admin two-step verification is enforced by default through `ADMIN_REQUIRE_TWO_FACTOR=true`.
- Seed data includes a demo admin account.
- Support admin endpoints exist for ticket listing, ticket detail, status updates, public replies, and internal notes.
- Media admin endpoints exist for listing media, reviewing entity context, and updating media status.
- Trade dispute admin endpoints exist for disputed trade review.
- User admin endpoint exists for listing users and updating trust tier.
- Money/payout/provider admin endpoints exist but are feature-gated by money visibility flags.

### Gaps before Phase 24.0

- There was no `/admin` landing page.
- Existing admin pages were scattered under direct URLs.
- Admin pages used repeated manual login/token forms.
- There was no single launch-safety overview with user, trade, support, media, and money-off state.
- Money admin pages existed in the web tree even when money features were hidden, which could confuse first-launch testing.
- No dedicated admin audit document existed for launch readiness.

## Implemented in Phase 24.0

### Backend

Added `GET /admin/overview`.

The endpoint returns:

- current admin preview
- feature flag state
- first-launch counts
- moderation queue counts
- recent users
- recent support tickets
- recent flagged or pending media

The endpoint uses the existing admin route guard, so non-admin users cannot read it.

### Web

Added `/admin` landing page.

The page provides:

- admin auth guard state
- 2FA requirement visibility
- launch health counters
- links to support, media, and disputes admin tools
- disabled money admin tiles while money features are hidden
- recent users
- recent support tickets
- flagged/pending media

### Shared API/contracts

Added admin overview response types and exposed `api.admin.overview()` from the shared API client.

## Deliberately not implemented yet

- user suspension
- profile hiding
- trade/need/offer hide/restore actions
- report data model
- admin action audit log table for non-payout actions
- admin user detail pages
- admin team permissions
- real payout approval changes
- money provider changes

Those belong to later Phase 24.x work.

## Safety notes

- Do not delete user accounts from admin tools during first launch.
- Use suspend/hide/restore workflows in the next moderation phase.
- Keep money features disabled for the first launch unless there is a separate legal/payment review.
- Admin accounts should keep authenticator-app 2FA enabled.
- Every future sensitive admin mutation should create an audit event with admin ID, action, target type, target ID, timestamp, and note/reason.

## Recommended next phases

### Phase 24.1 — Admin user list/detail and trust review polish

- Replace scattered manual admin login pages with session-based admin layout where practical.
- Add user detail page.
- Show user profile, country, signup date, trust tier, trade counts, support tickets, and media flags.
- Keep trust tier updates but add clearer notes.

### Phase 24.2 — User and content moderation actions

- Add account status/suspension model.
- Add hide/restore/close moderation fields for trades, needs, offers, and profiles.
- Add admin notes.
- Add general admin audit events.

### Phase 24.3 — Report system

- Add user report buttons.
- Add report model/API.
- Add admin report queue and resolve/dismiss actions.

### Phase 24.4 — Support admin polish

- Move support admin onto session-based admin shell.
- Improve ticket filters and internal note visibility.
- Link tickets to users/trades/media from admin detail pages.

### Phase 24.5 — Admin safety smoke test

- Verify non-admin blocking.
- Verify admin 2FA blocking.
- Verify hidden/suspended content disappears publicly.
- Verify suspended users cannot create/propose.
- Verify audit events are created for every sensitive action.
