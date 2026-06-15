# SAFETY3 — Admin moderation queue

SAFETY3 adds the first internal admin queue for the provider-neutral Safety Review foundation introduced in SAFETY1 and linked to reports in SAFETY2.

## Scope

- New API endpoints under `/admin/moderation/cases`.
- New web admin page at `/admin/moderation`.
- Admin navigation entry for Moderation.
- Case actions stored in `ModerationAction`.
- Admin audit log entries for every queue action.
- Linked reports are moved to `reviewing` or `resolved` when a case is handled.

## Not in scope

- No external moderation provider.
- No automatic text/image scanning.
- No new database models.
- No public user-facing moderation labels.
- No private-message scanning behavior change.

## Admin queue behavior

The queue lists `ModerationCase` records with:

- content type and content ID
- source (`report`, `upload`, `automatic`, `admin`, `backfill`)
- status
- priority
- target summary when the content type can be resolved through the existing report target lookup
- linked report context when a report created the case
- latest provider result, if any
- recent case actions

Default queue filter is `needs_review`.

## Actions

The admin page supports:

- `mark_needs_review`
- `approve`
- `limit`
- `remove`
- `restore`
- `reject`
- `resolve`
- `add_note`

Actions write both:

1. `ModerationAction`
2. `AdminAuditLog`

`remove` and `restore` also attempt to reuse the existing report target moderation helper for supported target types such as trade, need, offer, public message, media, plan, and plan place.

## Safety rule

The moderation queue owns the Hellowhen decision. Future providers may classify content, but the final app decision remains stored as a Hellowhen moderation case/action.
