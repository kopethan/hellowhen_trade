# Moderation Readiness Checklist

> Documentation note: this checklist is operational readiness guidance, not legal advice.

## Admin readiness

- Admin account exists with strong credentials.
- Admin two-step requirement is enabled for non-local launch.
- Default seed admin credentials are rotated or removed.
- `/admin` dashboard loads.
- Launch checklist, runtime QA, and moderation smoke checks run.
- Reports queue is cleared or each pending report has a decision.
- Urgent/high support tickets are claimed or resolved.
- Pending/flagged media has been reviewed.
- Audit log shows recent admin actions.

## Runtime moderation checks

- Restricted users cannot create/update/delete Needs, Offers, Trades, Proposals, messages, or marketplace media uploads.
- Restricted users’ public content is absent from public discovery/profile routes.
- Hide/restore/close actions affect public visibility correctly.
- Report-to-support escalation creates a linked support ticket.
- Block/unblock prevents blocked users from appearing in feed/profile discovery and prevents new proposal/message interactions between the pair.
- Account deletion requests create or link a support-visible request for follow-up.
- Public optional-auth reads degrade to anonymous when stale tokens are sent.
