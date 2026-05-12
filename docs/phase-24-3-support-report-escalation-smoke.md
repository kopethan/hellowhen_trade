# Phase 24.3 — Support admin polish, report escalation, and moderation smoke test

## Scope

Phase 24.3 keeps the first-launch admin area focused on safety and moderation. It does not enable wallet, payouts, Stripe, Airwallex, or money trades.

Implemented:

- Report-to-support escalation from the admin report queue.
- Escalation tracking on reports:
  - `escalatedSupportTicketId`
  - `escalatedAt`
  - `escalatedById`
- Support ticket creation for the reporter when a report needs follow-up.
- Admin audit logging for report escalation.
- Support inbox polish:
  - persisted admin token behavior aligned with other admin screens
  - search by ticket/user/message fields
  - assignment filter: all / unassigned / mine
  - direct ticket deep link via `/admin/support?ticketId=...`
  - claim/unassign ticket actions
  - quick status and priority actions
- Report queue polish:
  - `Escalate to support` action
  - link to the created support ticket
  - support-escalation status in report detail

## Runtime smoke test checklist

### Admin access guard

1. Open `/admin` while logged out.
2. Try loading the dashboard without a token.
3. Log in as a normal user and try `/admin/reports` or `/admin/support`.
4. Expected: non-admin users receive `admin_required`; admin users can load queues.
5. If `ADMIN_REQUIRE_TWO_FACTOR=true`, expected: admin without authenticator 2FA receives `admin_two_factor_required`.

### Report escalation

1. Create or seed a report against a public trade/profile/media target.
2. Open `/admin/reports`.
3. Load pending reports.
4. Select the report.
5. Add an internal note.
6. Click `Escalate to support`.
7. Expected:
   - report moves to `reviewing`
   - report receives `escalatedSupportTicketId`
   - support ticket is created for the reporter
   - support ticket is assigned to the admin who escalated it
   - admin audit log records `report.escalate_to_support`

### Support deep link

1. From the escalated report detail, click `Open support ticket`.
2. Expected: `/admin/support?ticketId=<id>` opens the support admin page.
3. After admin login/token refresh, expected: the exact ticket opens automatically.

### Support queue polish

1. Open `/admin/support`.
2. Search by ticket subject, message body, ticket ID, user email, display name, or handle.
3. Filter by `unassigned` and `mine`.
4. Claim a ticket.
5. Mark it in review, waiting for user, resolved, and closed.
6. Mark urgent and normalize priority.
7. Add an internal note.
8. Send a public reply.
9. Expected:
   - internal notes stay internal
   - public reply appears in user-visible ticket thread
   - status/priority/assignment changes are logged in `AdminAuditLog`

### Moderation safety

1. From a report, test `Mark reviewing`.
2. Test `Dismiss` with an internal note.
3. Test `Hide target` against supported targets: trade, need, offer, media.
4. Test `Suspend owner` against a target owned by a user.
5. Expected:
   - no hard deletes happen
   - hidden/closed content is removed from public surfaces according to existing visibility logic
   - restricted owner sessions are revoked
   - each action writes an admin audit log entry

## Intentional non-scope

- No automatic content takedowns.
- No AI moderation scoring.
- No admin team roles beyond existing admin role.
- No payout/wallet moderation expansion.
- No public user-facing notification system for escalated reports yet.
- Backend API error strings remain English for now.
