# SAFETY1 — Provider-neutral moderation foundation

This foundation prepares Hellowhen for future content-moderation providers without connecting an external API yet.

## Position

Hellowhen owns the safety workflow. External providers should only classify selected content and return labels, scores, and suggested actions. They should not receive full user profiles or decide final product actions directly.

## Data minimisation rule

Provider payloads should include only:

- content id
- content type
- public/private/reported-private visibility
- title, description, or message text when needed
- temporary image URL or media id when needed
- minimal app context such as country, app area, related trade id, or report id

Provider payloads should not include by default:

- email
- phone number
- legal name
- IP address
- exact address
- payment data
- full profile history
- unrelated private messages

## Current SAFETY1 scope

Included:

- shared moderation contracts and zod schemas
- provider-neutral names for future OpenAI/AWS/Google/Azure/human-review adapters
- moderation case/result/action database foundation
- API feature flags and production guard checks
- no-provider adapter that always skips scans safely

Not included yet:

- public report/block UI changes
- admin moderation queue changes
- public image pending pipeline
- real provider API calls
- automatic removal/hiding decisions

## Runtime flags

Keep these disabled for first launch:

```env
MODERATION_ENABLED=false
MODERATION_PROVIDER=none
MODERATION_TEXT_ENABLED=false
MODERATION_IMAGE_ENABLED=false
MODERATION_PRIVATE_MESSAGE_SCAN_ENABLED=false
MODERATION_STORE_RAW_PROVIDER_RESULT=false
```

Future provider launches can enable `MODERATION_ENABLED=true`, choose a provider, then enable text and/or image scans in a dedicated patch with rate limits, thresholds, and failure handling.
