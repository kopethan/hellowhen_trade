# Phase 24.5 — Admin final QA, seed/admin setup polish, and launch safety checklist

## Scope

This phase keeps the admin area focused on first-launch safety:

- admin access readiness
- report/support/media queues
- restricted-user and hidden-content runtime visibility
- audit log presence
- seed/admin setup clarity
- money-off launch gates

It does **not** enable wallet, payouts, Stripe, Airwallex, or money trades.

## New admin launch checklist

Backend endpoint:

```txt
GET /admin/launch-checklist
```

Web entry point:

```txt
/admin → Run launch checklist
```

The checklist returns:

- overall status: `pass`, `warning`, or `fail`
- per-check status and details
- recommended action for warnings/failures

Checks included:

1. Admin account exists.
2. Admin two-step policy is safe.
3. Default seed admin account has been reviewed.
4. Money features are gated for first launch.
5. Public visibility filter has no feed leaks.
6. Pending reports have been reviewed.
7. Urgent/high support tickets have been reviewed.
8. Pending/flagged media has been reviewed.
9. Admin audit log is active.
10. Marketplace content baseline exists.

Warnings are expected in local seed mode. Failures should be fixed before a public launch/demo.

## Seed/admin setup

Seed variables are now configurable in `.env`:

```txt
SEED_DEMO_PASSWORD=password123
SEED_ADMIN_EMAIL=admin@hellowhen.app
SEED_ADMIN_PASSWORD=password123
SEED_ADMIN_DISPLAY_NAME=Admin Reviewer
SEED_ADMIN_HANDLE=admin
```

For local development, the default demo credentials are still convenient.

For any non-local environment:

1. Set a unique `SEED_ADMIN_EMAIL`.
2. Set a strong `SEED_ADMIN_PASSWORD`.
3. Run `npm run prisma:seed`.
4. Log in as admin.
5. Enable authenticator app 2FA.
6. Keep `ADMIN_REQUIRE_TWO_FACTOR=true`.
7. Rotate/remove any default `admin@hellowhen.app` account before public launch.

## CLI smoke command

A small CLI check was added:

```txt
npm run admin:smoke
```

Optional variables:

```txt
API_URL=http://localhost:4000
ADMIN_EMAIL=admin@hellowhen.app
ADMIN_PASSWORD=password123
```

The command logs in, then checks:

- `/admin/overview`
- `/admin/moderation-smoke`
- `/admin/launch-checklist`

It exits with a non-zero code when:

- moderation smoke has feed leaks
- launch checklist has a `fail` status

If `ADMIN_REQUIRE_TWO_FACTOR=true`, browser-based admin QA is still required because the CLI cannot complete an authenticator challenge.

## Manual final QA checklist

Run before public beta:

1. Log in as admin.
2. Open `/admin`.
3. Run launch checklist.
4. Run moderation smoke.
5. Confirm money status says hidden/off.
6. Open `/admin/reports` and clear or escalate pending reports.
7. Open `/admin/support` and claim/update urgent tickets.
8. Open `/admin/media` and review pending/flagged media.
9. Open `/admin/content` and review non-discoverable stale rows.
10. Suspend a test user and confirm:
    - the user cannot create Need/Offer/Trade/Proposal.
    - their public profile returns unavailable.
    - their active public trades do not show in feed/profile.
11. Restore the test user and confirm an audit log entry exists.
12. Confirm `/admin/audit-log` or the dashboard recent actions show the change.

## Intentional launch constraints

Still intentionally not included:

- hard delete users/content
- advanced fraud scoring
- multi-admin permission roles
- payout approval workflow for production money
- wallet ledger admin mutations
- Stripe/Airwallex production controls

Those belong to a later money/admin phase.
