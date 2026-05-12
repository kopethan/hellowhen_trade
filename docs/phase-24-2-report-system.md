# Phase 24.2 — Report system, report buttons, and admin report queue

## Scope

This phase adds the first user-facing report system for launch safety.

Implemented:

- Report database model and Prisma migration.
- User report API.
- Admin report queue API.
- Web `/admin/reports` queue.
- Report buttons/panels on public profile and trade detail screens.
- Admin audit logging for report status changes and target moderation actions.

This phase does not enable wallet, payouts, Stripe, Airwallex, or money-trade behavior.

## Report targets

Supported report target types:

- `user`
- `profile`
- `trade`
- `need`
- `offer`
- `proposal`
- `message`
- `media`

The API resolves every report target before creating a report. The report stores the reporter, target type, target id, target owner when available, reason, details, status, and review metadata.

## User API

Endpoints:

```txt
POST /reports
GET /reports/mine
```

`POST /reports` behavior:

- Requires an authenticated user.
- Validates the report target exists.
- Blocks reporting your own content.
- Reuses an existing unresolved report from the same reporter for the same target instead of creating duplicates.
- Supports optional free-text details.

Report reasons:

- Spam
- Scam
- Harassment
- Illegal or unsafe content
- Fake profile
- Inappropriate image
- Other

## Web and native report entry points

Added user-facing report UI to:

- Web public profile page.
- Web trade detail page.
- Native public profile screen.
- Native trade detail screen.

The first visible entry points focus on public profile and trade pages because those are the safest launch-critical moderation surfaces.

## Admin API

Endpoints:

```txt
GET /admin/reports
PATCH /admin/reports/:reportId/action
```

Admin report filters:

- status
- target type
- reason
- search query

Admin actions:

- `mark_reviewing`
- `resolve`
- `dismiss`
- `hide_target`
- `suspend_target_owner`

Every admin action writes an `AdminAuditLog` entry.

## Target moderation from reports

`hide_target` behavior:

- Trade: sets `isPublic=false`.
- Need: sets `status=closed`.
- Offer: sets `status=closed`.
- Media: sets `status=removed` and records moderation review metadata.

`hide_target` is intentionally not applied to users, profiles, proposals, or messages because those need more specific product decisions in later phases.

`suspend_target_owner` behavior:

- Sets the target owner trust tier to `restricted`.
- Revokes active sessions.
- Clears sensitive-action verification.
- Uses the restricted-account guard from Phase 24.1 to prevent new marketplace writes.

## Web admin queue

Added:

```txt
/admin/reports
```

The queue supports:

- report filtering
- report selection
- reporter preview
- target preview
- target owner preview
- moderation notes
- mark reviewing / resolve / dismiss / hide target / suspend owner actions
- links to public targets and owner profiles when available

The central `/admin` dashboard now links to the report queue and includes pending/reviewing report counts.

## Still intentionally not included

- Proposal/message report buttons in every conversation surface.
- Automated moderation or fraud scoring.
- Per-user rate limiting for reports.
- Email/admin notifications.
- Advanced report assignment.
- Legal evidence export.
- Money, payout, wallet, Stripe, or Airwallex admin actions.

Those can be added in later safety phases after runtime QA.
