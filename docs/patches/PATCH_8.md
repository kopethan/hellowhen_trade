# Patch 8 — Feedback & Support Center

Patch 8 adds a lightweight support system for user feedback, help requests, bug reports, trade issues, credits questions, image/content issues, account issues, and safety concerns.

## What changed

- Added `SupportTicket` and `SupportTicketMessage` models.
- Added support categories, statuses, priorities, and sender roles.
- Added user support API routes under `/support`.
- Added admin support API routes under `/admin/support`.
- Added mobile Support Center in Account.
- Added mobile Support Ticket Detail conversation screen.
- Added web admin page at `/admin/support`.
- Seed now creates a demo support ticket between `demo@hellowhen.app` and `admin@hellowhen.app`.
- Fixed a duplicated `body` field in `ProposalMessage` from the previous patch.

## User API

```txt
GET    /support/tickets/mine
POST   /support/tickets
GET    /support/tickets/:ticketId
POST   /support/tickets/:ticketId/messages
PATCH  /support/tickets/:ticketId/status
```

Users can create tickets, see their own tickets, reply to non-closed tickets, close tickets, and reopen tickets.

## Admin API

```txt
GET    /admin/support/tickets
GET    /admin/support/tickets/:ticketId
PATCH  /admin/support/tickets/:ticketId
POST   /admin/support/tickets/:ticketId/messages
```

Admins can filter tickets, open ticket conversations, reply publicly, add internal notes, and move tickets through statuses.

## Support statuses

```txt
open
in_review
waiting_for_user
resolved
closed
```

## Support categories

```txt
general_feedback
trade_issue
credits_issue
media_issue
bug_report
account_issue
safety_concern
```

## Not added

- No full customer-service platform.
- No notification system.
- No email delivery.
- No realtime chat/socket system.
- No attachment upload inside support messages.
- No AI moderation.
- No Stripe payout or production money changes.
