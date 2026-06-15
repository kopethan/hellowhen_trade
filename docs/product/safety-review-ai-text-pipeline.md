# SAFETY7 — AI text review pipeline foundation

SAFETY7 adds the internal foundation for checking newly created or edited text content with the provider-neutral moderation adapter from SAFETY5.

This patch does **not** enforce moderation decisions on create/edit routes yet. Enforcement belongs to SAFETY8.

## Goals

- Add explicit flags for future text review on create/edit.
- Support public content surfaces first: trades, needs, offers, profiles, and public messages.
- Keep private message review disabled unless explicitly enabled later.
- Store provider results and a Hellowhen-owned decision separately.
- Keep the default configuration fully disabled.

## New flags

```env
AI_TEXT_REVIEW_ON_CREATE_ENABLED=false
AI_TEXT_REVIEW_ON_EDIT_ENABLED=false
AI_TEXT_REVIEW_PUBLIC_MESSAGES_ENABLED=false
AI_TEXT_REVIEW_PROFILE_ENABLED=false
AI_TEXT_REVIEW_PRIVATE_MESSAGES_ENABLED=false
MODERATION_TEXT_FAIL_MODE=allow_with_case
```

These flags require the existing moderation foundation flags when enabled:

```env
MODERATION_ENABLED=true
MODERATION_PROVIDER=mock
MODERATION_TEXT_ENABLED=true
```

For a later production provider, `MODERATION_PROVIDER` can become a real adapter after a dedicated provider patch.

## Fail mode

`MODERATION_TEXT_FAIL_MODE` controls the decision returned when a provider scan fails:

- `allow_with_case`: record the failure, but future enforcement can allow the content.
- `hold_pending`: record the failure and future enforcement can hold the content for review.
- `reject`: record the failure and future enforcement can reject the content.

SAFETY7 only records the decision. It does not block or hide content.

## New API helper

The API now has:

```ts
runAiTextReview(input)
```

It:

1. Checks feature flags.
2. Builds a minimal moderation text payload.
3. Calls the configured SAFETY5 provider adapter.
4. Stores a `ModerationResult`.
5. Records a Hellowhen decision:
   - `approved`
   - `needs_review`
   - `rejected`
   - `skipped`
   - `provider_failed`
6. Updates/creates a `ModerationCase` for admin review visibility.

## Privacy rule

The pipeline sends only the minimum content payload:

- content id
- content type
- visibility
- title / description / message
- locale when available
- app area / related trade/report id when useful

It does not send:

- email
- phone
- real name
- exact address
- full account history
- unrelated private messages

## Supported surfaces

Public surfaces:

- `trade`
- `need`
- `offer`
- `profile`
- `public_message`

Private surfaces are disabled by default and require both:

```env
AI_TEXT_REVIEW_PRIVATE_MESSAGES_ENABLED=true
MODERATION_PRIVATE_MESSAGE_SCAN_ENABLED=true
```

## Recommended local mock test setup

```env
MODERATION_ENABLED=true
MODERATION_PROVIDER=mock
MODERATION_TEXT_ENABLED=true
AI_TEXT_REVIEW_ON_CREATE_ENABLED=true
AI_TEXT_REVIEW_ON_EDIT_ENABLED=true
AI_TEXT_REVIEW_PUBLIC_MESSAGES_ENABLED=true
AI_TEXT_REVIEW_PROFILE_ENABLED=true
AI_TEXT_REVIEW_PRIVATE_MESSAGES_ENABLED=false
MODERATION_TEXT_FAIL_MODE=allow_with_case
```

The mock provider is deterministic and keyword-based. It is for local testing only.

## Next patch

SAFETY8 should wire this helper into create/edit routes and add user-safe UI states:

- approved: publish normally
- needs_review: save but hold/hide/limit based on route
- rejected: block publish with safe message
- provider_failed: follow `MODERATION_TEXT_FAIL_MODE`
