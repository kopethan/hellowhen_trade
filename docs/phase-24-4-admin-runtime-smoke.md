# Phase 24.4 — Admin smoke test, hidden-content verification, and restricted-user runtime QA

## Goal

Verify that launch-admin moderation changes affect runtime/public behavior, not only the admin UI.

This phase keeps the first-launch admin scope focused on safety moderation. It does not enable wallet, payouts, Stripe, Airwallex, real-money trades, or advanced fraud automation.

## Runtime visibility fixes

Public discovery now uses one shared API visibility filter for public trades:

- trade must be `active`
- trade must be `isPublic: true`
- trade must not be expired
- trade owner must not have trust tier `restricted`
- linked Need, when present, must still be `active`
- linked Offer, when present, must still be `active`

This filter is used by:

- `GET /trades/feed`
- unauthenticated/non-participant access to `GET /trades/:tradeId`
- proposal creation through `POST /trades/:tradeId/proposals`
- public profile sections under `GET /users/:userId/public-profile`

Participants can still access their own/accepted proposal context where needed, but restricted-owner content is no longer publicly discoverable.

## Admin smoke endpoint

New endpoint:

```txt
GET /admin/moderation-smoke
```

It returns counts for:

- feed-eligible public trades
- active public trades owned by restricted users
- active public trades linked to closed Needs
- active public trades linked to closed Offers
- restricted users
- active Needs/Offers owned by restricted users

It also returns sample content rows for admin review when stale public data exists.

## Web admin polish

The `/admin` dashboard now includes a **Run moderation smoke** action and a runtime visibility panel.

The `/admin/content` queue now shows:

- whether each item is public-discoverable
- visibility blockers such as owner restricted, hidden trade, closed Need, closed Offer, expired trade

## Manual smoke checklist

### 1. Admin restricts a user

1. Log in as admin.
2. Open `/admin`.
3. Select a normal user with active public trades.
4. Add an internal note.
5. Click **Suspend user**.
6. Run **moderation smoke**.
7. Confirm restricted user count increased.
8. Confirm the user's existing public trades no longer appear in `/trades/feed`.
9. Confirm `/users/<restrictedUserId>` returns not found for public visitors.

Expected result: restricted users can still contact support, but cannot create/update/delete Needs/Offers, create/delete/close Trades, create proposals, update proposal status, or send proposal messages.

### 2. Admin hides or closes a Need/Offer

1. Open `/admin/content`.
2. Select an active Need or Offer used by a public trade.
3. Add an internal note.
4. Click **Hide** or **Close**.
5. Run **moderation smoke**.
6. Confirm linked public trades are marked with visibility blockers and do not appear in public feed.

Expected result: the inventory item is closed/restored without deleting user data. Linked active trades are excluded from public discovery while the underlying Need/Offer is closed.

### 3. Admin hides a trade

1. Open `/admin/content`.
2. Select an active trade.
3. Add an internal note.
4. Click **Hide**.
5. Confirm the trade becomes hidden/not public-discoverable.
6. Confirm unauthenticated/non-participant detail access returns not found.
7. Confirm owner/participant context still works where existing permissions allow.

### 4. Report queue action smoke

1. Submit a report from a non-owner user.
2. Open `/admin/reports`.
3. Use **Hide target**.
4. Confirm the target disappears from public discovery.
5. Use **Suspend target owner** on another report.
6. Confirm sessions are revoked and public content disappears from discovery.

## Intentional non-goals

- No real-money admin workflow changes.
- No automatic AI moderation.
- No permanent delete workflows.
- No complex admin role splitting yet.
- No backend localization of admin/API error messages.
