# SAFETY8 — Text review enforcement on create/edit

SAFETY8 connects the SAFETY7 provider-neutral AI text review pipeline to selected create/edit routes.

The default configuration remains fully disabled. No external provider is connected by this patch.

## Goals

- Keep public text surfaces auditable through `ModerationCase`, `ModerationResult`, and `ModerationAction`.
- Allow safe route-level enforcement when text review flags are intentionally enabled.
- Keep private proposal messages out of default scanning/enforcement.
- Keep Hellowhen as the final decision layer: provider results become Hellowhen decisions, then route actions.

## New flag

```env
AI_TEXT_REVIEW_ENFORCEMENT_ENABLED=false
```

This flag is separate from the SAFETY7 review flags so the app can run text review in record-only mode first.

A local mock test setup can use:

```env
MODERATION_ENABLED=true
MODERATION_PROVIDER=mock
MODERATION_TEXT_ENABLED=true
AI_TEXT_REVIEW_ON_CREATE_ENABLED=true
AI_TEXT_REVIEW_ON_EDIT_ENABLED=true
AI_TEXT_REVIEW_PUBLIC_MESSAGES_ENABLED=true
AI_TEXT_REVIEW_PROFILE_ENABLED=true
AI_TEXT_REVIEW_ENFORCEMENT_ENABLED=true
MODERATION_TEXT_FAIL_MODE=allow_with_case
```

Production first-launch guards still block automated moderation/provider flags until a dedicated launch decision is made.

## Enforced surfaces

SAFETY8 wires route-level text review for:

- trade creation
- need creation/edit when the item is intended to be active
- offer creation/edit when the item is intended to be active
- profile edit
- public discussion message creation/edit

Private proposal messages are intentionally not wired in this patch.

## Decision behavior

| Text decision | Route behavior |
| --- | --- |
| `allow` | Normal create/edit response. |
| `hold_pending` | Public content is kept out of public visibility and returned with `202` where a pending state exists. |
| `reject` | Public content is kept out of public visibility and the route returns a safe `409` response. |
| `provider_failed` | Uses `MODERATION_TEXT_FAIL_MODE`: `allow_with_case`, `hold_pending`, or `reject`. |
| `skipped` | No enforcement. |

## Content state mapping

| Surface | Hold pending | Reject |
| --- | --- | --- |
| Trade | `isPublic=false` | `status=closed`, `isPublic=false` |
| Need | `status=pending_review` | `status=rejected` |
| Offer | `status=pending_review` | `status=rejected` |
| Public message | `status=hidden` | `status=hidden` |
| Profile | update blocked with a safe response | update blocked with a safe response |

Trade does not currently have a `pending_review` or `rejected` status. Hold-pending unpublishes it through `isPublic=false`; rejected trade text closes the hidden trade so the user can create a corrected version.

## Admin queue behavior

The admin moderation queue can now sync automatic text-review actions back to target content:

- approve/restore automatic trade cases republishes the trade
- approve/restore need/offer cases moves them back to `active`
- approve/restore public message cases makes them `visible`
- mark/reject/limit/remove keeps the target hidden, pending, rejected, or closed depending on the target type

## User-facing copy

Routes return safe, generic copy such as:

- `This content needs review before it can be public.`
- `This content cannot be published because it may break our safety rules. Please edit it and try again.`

Do not expose raw provider labels or provider names to users.

## Out of scope

- No real OpenAI/AWS/Google/Azure moderation adapter.
- No image/video AI moderation.
- No default private-message scanning.
- No public “AI moderation” wording.
