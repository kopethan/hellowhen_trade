# Hidden AI foundation

AI is future scaffolding only for the first Hellowhen Trade launch.

The first launch must keep all AI features disabled by default:

```env
AI_ENABLED=false
AI_PROVIDER=none
AI_MODERATION_ENABLED=false
AI_SUGGESTIONS_ENABLED=false
AI_ADMIN_ASSIST_ENABLED=false
AI_SAFETY_CLASSIFIER_ENABLED=false
AI_PRIVATE_CONTENT_ENABLED=false
```

Public web and native flags must also stay disabled:

```env
NEXT_PUBLIC_AI_ENABLED=false
NEXT_PUBLIC_AI_PROVIDER=none
EXPO_PUBLIC_AI_ENABLED=false
EXPO_PUBLIC_AI_PROVIDER=none
```

## Current behavior

The hidden foundation adds flags, shared provider/task/surface types, and client feature state only.

It does not add:

- AI SDKs.
- AI API keys.
- provider network calls.
- automatic moderation decisions.
- private-message analysis.
- user-visible AI buttons.
- training or fine-tuning behavior.

With the default environment, the UI and API behavior should not change.

## Provider scaffolding

The shared provider type currently allows:

- `none`
- `openai`
- `gemini`
- `groq`

No provider is connected in this patch. Hellowhen clients should call Hellowhen's backend later, not provider APIs directly.

## Allowed future AI surfaces

These are the only surfaces that should be considered first:

- `admin_moderation`: summarize reports/support context and suggest risk labels for human review.
- `need_offer_writing`: suggest clearer titles/descriptions while the user remains in control.
- `starter_templates`: admin-only help for creating starter Needs/Offers.
- `safety_classification`: safety hints for spam/scam/unsafe-content triage, never automatic punishment.

## Forbidden or high-risk surfaces

Do not add AI to these surfaces without a separate privacy/legal/safety review:

- Private proposal conversations.
- Private messages.
- Support private threads.
- Report private queues, except human-admin summarization with strict controls.
- Account security and two-factor authentication screens.
- Admin actions that automatically punish, suspend, hide, accept, decline, or message users.
- Create/edit forms that auto-submit content without user confirmation.

## Human-in-the-loop rule

AI must only assist. It must not make final decisions.

Examples:

- Good: “This report may involve spam. Review before action.”
- Bad: automatically suspend the reported user.
- Good: “Suggested improved description” with an Apply button.
- Bad: silently rewrite and publish a user’s Need/Offer.

## First-launch production guard

While `FIRST_LAUNCH_GUARDS_ENABLED=true`, production config validation rejects enabled AI flags or a provider other than `none`.

This keeps AI out of the first launch until the product has privacy copy, user controls, provider selection, logging rules, data retention rules, and EU/France compliance review.

## Later real integration checklist

Before connecting OpenAI, Gemini, Groq, or another provider:

1. Choose exactly which AI surface is being enabled.
2. Add privacy-policy language explaining what content may be sent to the provider.
3. Avoid sending private proposal/message content by default.
4. Add user consent or clear user action for writing assistance.
5. Add admin audit logs for AI-assisted moderation suggestions.
6. Add provider API key management through server-only env variables.
7. Add rate limits and abuse protection.
8. Add prompt-injection protections for user-generated content.
9. Add retention/redaction rules for prompts and outputs.
10. Confirm App Store / Google Play privacy declarations before mobile release.
