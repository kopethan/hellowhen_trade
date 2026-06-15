# SAFETY9 — First real AI text provider

SAFETY9 connects the provider-neutral moderation adapter from SAFETY5 to OpenAI's standalone moderation endpoint for **text-only** scans.

This patch does not add image or video moderation. Public image handling remains covered by the manual/public-image pipeline and logged-out media visibility flags.

## Provider

Use:

```env
MODERATION_ENABLED=true
MODERATION_PROVIDER=openai
MODERATION_TEXT_ENABLED=true
MODERATION_IMAGE_ENABLED=false
MODERATION_PROVIDER_API_KEY=your_openai_api_key
OPENAI_MODERATION_MODEL=omni-moderation-latest
```

`MODERATION_PROVIDER_ENDPOINT` is optional. Leave it empty to use:

```txt
https://api.openai.com/v1/moderations
```

Use a custom endpoint only for proxies, local tests, or future provider-compatible gateways.

## Recommended local text-review test flags

```env
MODERATION_ENABLED=true
MODERATION_PROVIDER=openai
MODERATION_TEXT_ENABLED=true
MODERATION_IMAGE_ENABLED=false
MODERATION_PRIVATE_MESSAGE_SCAN_ENABLED=false
MODERATION_PROVIDER_API_KEY=your_openai_api_key
OPENAI_MODERATION_MODEL=omni-moderation-latest
AI_TEXT_REVIEW_ON_CREATE_ENABLED=true
AI_TEXT_REVIEW_ON_EDIT_ENABLED=true
AI_TEXT_REVIEW_PUBLIC_MESSAGES_ENABLED=true
AI_TEXT_REVIEW_PROFILE_ENABLED=true
AI_TEXT_REVIEW_PRIVATE_MESSAGES_ENABLED=false
AI_TEXT_REVIEW_ENFORCEMENT_ENABLED=false
MODERATION_TEXT_FAIL_MODE=allow_with_case
```

Then turn enforcement on only after reviewing mock and OpenAI results in the admin queue:

```env
AI_TEXT_REVIEW_ENFORCEMENT_ENABLED=true
MODERATION_TEXT_FAIL_MODE=hold_pending
```

## What is sent

The OpenAI adapter sends only minimal content/context:

```txt
Content type
Visibility
Country/app area when present
Locale when present
Title/description/message text
```

It does not send email, phone, IP address, real name, full profile history, wallet/payment data, or unrelated private messages.

## Result mapping

OpenAI category scores are mapped into Hellowhen's shared moderation labels:

```txt
sexual / sexual-minors      -> adult / sexual
harassment / hate           -> hate_or_harassment
self-harm                   -> self_harm
violence                    -> violence
illicit                     -> illegal_or_regulated
```

The shared decision helper still makes the final Hellowhen decision:

```txt
low / none       -> allow
medium           -> needs_review / hold_pending
high / critical  -> rejected / needs_review
provider failure -> follows MODERATION_TEXT_FAIL_MODE
```

## Important launch note

The first-launch production guard still blocks external moderation providers by default. To test this in production later, intentionally plan that as a separate launch step and review production flags first.

Do not enable private message scanning by default. Keep private messages scanned only when reported or when a later explicit policy requires it.
