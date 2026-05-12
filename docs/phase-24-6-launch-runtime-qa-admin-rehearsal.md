# Phase 24.6 — Final launch-mode runtime QA and admin moderation rehearsal

## Scope

This phase is the final first-launch admin safety pass before moving on to the next product area.

It keeps the launch mode conservative:

- no wallet enablement
- no payout enablement
- no Stripe production flow
- no Airwallex production flow
- no money-trade enablement
- no permanent delete tools

## Runtime safety fix

Admin suspend/force-logout actions already revoked sessions in the database, but authenticated middleware did not verify access tokens against session revocation on every request.

This phase updates API auth middleware so authenticated requests now validate:

- access token signature/expiry
- user existence
- global `User.sessionRevokedAt`
- per-session `Session.revokedAt`
- per-session expiry
- session/user ownership

Public optional-auth reads still stay user-friendly: if a stale, expired, invalid, or revoked token is sent to a public route, the request falls back to anonymous access instead of breaking public discovery.

## Trust-tier safety polish

The generic admin trust-tier endpoint now treats moving a user to `restricted` as a full moderation restriction:

- blocks self-restriction by the current admin
- revokes active sessions
- clears fresh sensitive-action verification
- writes session-revocation context to the admin audit log

The dedicated Suspend action already did this; this closes the alternate path where an admin could set `restricted` through the trust-tier control.

## New runtime QA endpoint

Backend endpoint:

```txt
GET /admin/runtime-qa
```

The response includes:

- overall runtime QA status
- launch-mode flags
- restricted users with active sessions
- active public money/credit trades while money launch is off
- public visibility leak count
- pending report/support/media queue counts
- human-readable moderation rehearsal steps

Web entry point:

```txt
/admin → Run runtime QA
```

CLI entry points:

```txt
npm run admin:smoke
npm run admin:rehearsal
```

Both CLI commands call:

- `/admin/overview`
- `/admin/moderation-smoke`
- `/admin/launch-checklist`
- `/admin/runtime-qa`

The CLI exits non-zero when launch checklist or runtime QA has a `fail` status, or when moderation smoke finds feed leaks.

## Manual browser + Expo rehearsal

Use this with a seeded local API, web app, and Expo app.

### 1. Admin dashboard loads

1. Start API.
2. Start web.
3. Open `/admin`.
4. Log in as admin.
5. Click **Load dashboard**.

Expected:

- overview loads
- launch checklist loads
- runtime QA loads
- moderation smoke loads
- money status remains hidden/off for first launch

### 2. Suspend test user

1. In `/admin`, select a non-admin test user.
2. Add an internal note.
3. Click **Suspend user**.
4. Click **Run runtime QA** and **Run moderation smoke**.

Expected:

- user becomes `restricted`
- sessions are revoked
- runtime QA does not show open restricted sessions after refresh/re-login cleanup
- public profile returns unavailable
- user-owned active public trades disappear from feed/profile discovery

### 3. Verify stale user sessions

Using the suspended user session in web or Expo:

Expected:

- create/update/delete Need is blocked
- create/update/delete Offer is blocked
- create/delete/close Trade is blocked
- create proposal is blocked
- update proposal status is blocked
- send proposal message is blocked
- support access remains available
- public feed still loads as anonymous when stale auth is present

### 4. Hide/restore content

1. Open `/admin/content`.
2. Hide or close one test trade/need/offer with an internal note.
3. Run moderation smoke.
4. Restore the item if needed.

Expected:

- hidden/closed content is not discoverable
- linked closed Need/Offer blocks trade discovery
- audit log records the action
- restore changes status back to active where supported

### 5. Report-to-support escalation

1. Submit a report from a non-owner user.
2. Open `/admin/reports`.
3. Add an internal note.
4. Escalate to support.

Expected:

- report moves to `reviewing`
- support ticket is created and linked
- ticket is assigned to the admin
- audit log records `report.escalate_to_support`

### 6. Final launch checks

Before any public beta/demo:

1. `npm run admin:smoke`
2. `/admin → Run launch checklist`
3. `/admin → Run runtime QA`
4. `/admin → Run moderation smoke`
5. Clear or document warnings:
   - pending reports
   - urgent/high support tickets
   - pending/flagged media
   - default seed admin account
   - admin accounts missing 2FA

## Intentional non-goals

Still intentionally not included:

- multi-role admin permissions
- irreversible deletion
- automated fraud scoring
- production payout approval
- wallet ledger admin mutation
- provider dashboard mutations
- AI moderation
