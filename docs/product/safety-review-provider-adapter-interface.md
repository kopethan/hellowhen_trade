# SAFETY5 — Provider adapter interface

SAFETY5 turns the SAFETY1 no-provider moderation foundation into a real adapter layer without connecting any external moderation service yet.

## What this patch adds

- A provider-neutral adapter interface for text, image, and combined scans.
- A deterministic `mock` provider for local/manual testing.
- Placeholder adapters for later real providers:
  - `openai`
  - `aws_rekognition`
  - `google_vision`
  - `azure_content_safety`
  - `human_review`
- Timeout and retry wrapping for provider scans.
- Structured provider-result metadata storage:
  - provider request id
  - duration in milliseconds
  - attempt count
  - retryable flag
  - highest severity
  - suggested action
- Shared provider-result persistence helper reused by the public image review pipeline.
- Admin moderation queue displays scan attempts and duration when present.

## What this patch does not add

- No OpenAI/AWS/Google/Azure SDK.
- No external network call.
- No provider credentials are required.
- No automatic moderation enforcement.
- No private-message scanning change.

## Provider behavior

### `none`

Returns a skipped provider result.

### `mock`

Returns deterministic local results based on safety keywords in the payload text, image URL, or MIME type. This is only for testing the pipeline.

Example local test flags:

```env
MODERATION_ENABLED=true
PUBLIC_IMAGE_REVIEW_ENABLED=true
MODERATION_PROVIDER=mock
MODERATION_IMAGE_ENABLED=true
MODERATION_TEXT_ENABLED=false
MODERATION_PRIVATE_MESSAGE_SCAN_ENABLED=false
MODERATION_PROVIDER_MAX_RETRIES=0
```

### Future real providers

The external provider names are registered, but they return a structured failure with `provider_not_implemented` until a later provider-specific patch connects one of them.

This makes accidental early activation obvious without sending user content outside Hellowhen.

## Retry and timeout settings

```env
MODERATION_PROVIDER_TIMEOUT_MS=10000
MODERATION_PROVIDER_MAX_RETRIES=0
```

Rules:

- Timeout is bounded by the API config parser.
- Retries are bounded from `0` to `3`.
- A timeout or thrown provider error is stored as a failed provider result instead of crashing the review pipeline.

## Privacy rule

The adapter receives the provider-neutral moderation payload only. It should not receive email, phone number, legal name, exact address, payment information, or unrelated private messages.

Hellowhen stays the decision-maker. Providers only return classification evidence.
