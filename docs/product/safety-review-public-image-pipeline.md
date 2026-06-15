# SAFETY4 — Public image review pipeline

SAFETY4 adds a provider-neutral manual review path for images that appear on public Hellowhen surfaces.

## Scope

The pipeline covers images attached to:

- profiles
- trades
- needs
- offers

It does not connect an external moderation provider. Provider scans still use the SAFETY1 no-provider adapter unless a later patch adds a real provider.

## Feature flag

```env
MODERATION_ENABLED=true
PUBLIC_IMAGE_REVIEW_ENABLED=true
MODERATION_PROVIDER=none
MODERATION_IMAGE_ENABLED=false
```

`PUBLIC_IMAGE_REVIEW_ENABLED=true` requires `MODERATION_ENABLED=true` in production so review cases are explicit and auditable.

## Behavior

When the flag is disabled, current image behavior remains unchanged.

When the flag is enabled:

1. Users upload images normally.
2. When an image is attached to a public profile, trade, need, or offer, the media status moves to `pending_review`.
3. A `ModerationCase` is created with source `upload` and status `needs_review`.
4. A no-provider image scan result is stored as skipped unless a later provider patch changes the adapter.
5. Public deck/detail media loaders continue to show only `active` images.
6. Owners and admins can still see pending/flagged image states.
7. Admin approval moves the image back to `active` and resolves the moderation case as approved.

## Admin review

Admins can review images from:

- `/admin/media`
- `/admin/moderation`

Actions map as follows:

| Admin action | Media status | Moderation case status |
| --- | --- | --- |
| Approve / restore | `active` | `approved` |
| Keep pending | `pending_review` | `needs_review` |
| Flag / limit | `flagged` | `limited` |
| Remove / reject | `removed` | `removed` or `rejected` |

Every status change writes `ModerationAction` and `AdminAuditLog` history.

## Privacy/data notes

Provider payloads include only the media ID, media URL, MIME type, size, and public app area. They do not include email, phone, IP address, real name, or private profile data.

Pending and flagged files can be previewed by unguessable upload storage key, but public entity media arrays expose only active media. Removed files are never served.

## Not included

- no external image scanner
- no AI/image classification model
- no private message scan changes
- no automatic rejection thresholds
- no push/email notifications
