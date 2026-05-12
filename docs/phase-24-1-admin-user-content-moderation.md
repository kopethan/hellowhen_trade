# Phase 24.1 — Admin user and content moderation actions

## Scope

This phase adds the first concrete launch-admin moderation actions without building a large enterprise admin system.

Implemented:

- Admin user moderation endpoint.
- Admin content moderation endpoint for trades, needs, and offers.
- Web `/admin/content` moderation page.
- Suspend / restore / force logout actions on the central `/admin` user detail panel.
- Audit log entries for all new moderation actions.
- Restricted-account write guard for new posts/proposals and trade/inventory mutations.

## User moderation behavior

Endpoint:

```txt
PATCH /admin/users/:userId/moderation
```

Actions:

- `suspend`
  - Sets `trustTier` to `restricted`.
  - Revokes active sessions.
  - Clears sensitive-action verification.
  - Blocks new trade/need/offer/proposal writes through the new active-account guard.
  - Writes `user.moderation.suspend` to `AdminAuditLog`.

- `restore`
  - Sets the user to a non-restricted trust tier, defaulting to `new`.
  - Writes `user.moderation.restore` to `AdminAuditLog`.

- `force_logout`
  - Revokes active sessions without changing trust tier.
  - Writes `user.moderation.force_logout` to `AdminAuditLog`.

- `mark_reviewed`
  - Updates review note/timestamp context through audit logging without deleting the account.

Admins cannot suspend their own account.

## Restricted-account guard

The new `requireActiveAccount` middleware blocks `restricted` users from write paths that can create or move marketplace state:

- Create/update/delete needs.
- Create/update/delete offers.
- Create/delete/close trades.
- Create proposals.
- Update proposal status.
- Send proposal messages.

Support access is intentionally not blocked so a restricted user can still contact support.

## Content moderation behavior

Endpoint:

```txt
GET /admin/content
PATCH /admin/content/:type/:contentId/action
```

Supported content types:

- `trade`
- `need`
- `offer`

Actions:

- `hide`
  - Trade: sets `isPublic=false`.
  - Need/offer: sets `status=closed`.

- `restore`
  - Trade: sets `isPublic=true`; restores `closed`/`expired` trades to `active`.
  - Need/offer: sets `status=active`.

- `close`
  - Trade: sets `status=closed`, `isPublic=false`, and `closedAt`.
  - Need/offer: sets `status=closed`.

- `mark_reviewed`
  - Writes audit history only.

Funded, in-progress, submitted, and disputed trades cannot be closed through the generic content endpoint. They must go through the dispute/admin trade flow to avoid unsafe money-state changes later.

## Web admin UI

Added:

```txt
/admin/content
```

The page supports:

- filter by content type
- filter by status
- search title/description
- filter by owner ID
- select content item
- hide / restore / close / mark reviewed
- required internal note for visibility/status-changing actions

The central `/admin` page now includes:

- link to content moderation
- suspend user
- restore user
- force logout

## Still intentionally not included

- Hard delete user/content.
- Advanced role hierarchy.
- Admin team permissions.
- Money payout approval changes.
- Stripe/Airwallex operational actions.
- Automated fraud scoring.

Those belong in later launch-admin or money-launch phases.
