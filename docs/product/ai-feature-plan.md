# AI Feature Plan

## Purpose

Hellowhen Trade can use AI to help users write better Needs, Offers, Trades, proposals, and support requests.

AI should improve the user experience, but it should not replace user control, safety checks, moderation, or admin decisions.

AI features should be routed by task type. Hellowhen should not use one model for every AI job.

## Core Principle

Use the cheapest reliable model for each task.

```txt
Simple task → rules or cheap model
Writing task → mid-quality model
Full draft task → stronger model
Safety task → moderation model
Paid/advanced task → better model or higher limits
```

AI should be handled by the backend API, not directly by the web or mobile app.

Frontend apps should call Hellowhen’s own API. The backend decides:

* whether AI is enabled
* whether the user has access
* which provider/model to use
* which limits apply
* whether moderation is required
* how to log usage and cost

## Supported AI Providers

Hellowhen may use:

* Groq
* Google Gemini
* OpenAI

Do not hardcode the app to one provider.

Use a provider abstraction so models can be changed later without rewriting product screens.

Example environment strategy:

```txt
AI_ENABLED=false

AI_PROVIDER_DEFAULT=gemini
AI_PROVIDER_FAST=groq
AI_PROVIDER_WRITING=openai
AI_PROVIDER_MODERATION=openai

AI_MODEL_FAST=...
AI_MODEL_SUPPORT=...
AI_MODEL_REWRITE=...
AI_MODEL_DRAFT=...
AI_MODEL_MODERATION=...
```

## Provider Roles

### Groq

Best for:

* simple support answers
* fast app help
* lightweight classification
* simple routing
* cheap Free-tier AI tasks
* quick rewriting when quality requirements are low

Groq should be used where speed and low cost matter more than deep reasoning.

### Gemini

Best for:

* general support assistant
* FAQ-style answers
* Need/Offer improvement
* category suggestions
* title suggestions
* medium-cost drafting
* scalable Free/Plus AI usage

Gemini can be a strong default provider for balanced quality and cost.

### OpenAI

Best for:

* higher-quality rewriting
* full Need drafts
* full Offer drafts
* full Trade drafts
* proposal writing
* structured JSON output
* moderation
* more sensitive user-facing AI tasks
* advanced Plus/Pro features

OpenAI can use different models depending on task complexity.

Do not use the same OpenAI model for everything.

## AI Task Types

The backend should route AI requests by task type.

Recommended task types:

```txt
support_navigation
support_answer
rewrite_need_title
rewrite_need_description
rewrite_offer_title
rewrite_offer_description
draft_need
draft_offer
draft_trade
proposal_helper
category_suggestions
tag_suggestions
trade_summary
support_ticket_summary
admin_summary
moderation_check
```

## Task Routing

### 1. Support Navigation

Examples:

```txt
Where is the support page?
Open settings.
How do I create a Need?
Where can I edit my profile?
```

Preferred handling:

```txt
Rules first.
AI only if rules cannot answer.
```

Provider:

```txt
Primary: rules/no AI
Fallback: Groq or Gemini
```

Behavior:

* If the user asks to open a known page, navigate directly.
* If the user asks how to do something simple, answer from app help content.
* Do not use an expensive model for simple navigation.

Example output:

```json
{
  "type": "navigation",
  "target": "/account/support",
  "message": "Opening Support."
}
```

### 2. Simple Support Answer

Examples:

```txt
What is a proposal?
What is a Need?
What is an Offer?
Can I trade money?
Why can’t I see wallet?
```

Provider:

```txt
Primary: Groq or Gemini
Fallback: OpenAI small model
```

Rules:

* Use Hellowhen product docs as context.
* Keep answers short.
* Do not invent features.
* Do not expose roadmap features as active.
* Do not give legal/payment promises.

### 3. Rewrite Need

Examples:

```txt
Make my Need clearer.
Improve this Need title.
Make this description sound better.
```

Provider:

```txt
Primary: Gemini or OpenAI small/mid model
Fallback: Groq for simple text
```

Input:

```json
{
  "title": "need help photos",
  "description": "i need photos for my food page",
  "category": "services",
  "mode": "local"
}
```

Output:

```json
{
  "title": "Need food photos for my restaurant page",
  "description": "I need clean, natural food photos for my restaurant’s social media and online menu. The photos should show a few dishes clearly and work well for Instagram and website use.",
  "suggestedTags": ["photography", "food", "restaurant", "local"]
}
```

### 4. Rewrite Offer

Examples:

```txt
Improve my Offer.
Make this Offer more professional.
Help me explain what I can offer.
```

Provider:

```txt
Primary: Gemini or OpenAI small/mid model
Fallback: Groq for simple text
```

Output should preserve the user’s meaning and not exaggerate what they can provide.

### 5. Draft Need

Examples:

```txt
Create a Need for someone to design my logo.
Create a Need for help moving furniture.
Create a Need for product photos.
```

Provider:

```txt
Primary: OpenAI small/mid model
Fallback: Gemini
```

Output should be structured:

```json
{
  "title": "",
  "description": "",
  "category": "",
  "mode": "",
  "suggestedTags": [],
  "questionsForUser": []
}
```

Rules:

* Draft, do not publish automatically.
* User must review and confirm.
* Ask follow-up questions only when required.
* Avoid overpromising results.

### 6. Draft Offer

Examples:

```txt
I can repair bikes, write me an Offer.
I can cook homemade meals, create an Offer.
I can translate English to French, create an Offer.
```

Provider:

```txt
Primary: OpenAI small/mid model
Fallback: Gemini
```

Output:

```json
{
  "title": "",
  "description": "",
  "includes": [],
  "category": "",
  "mode": "",
  "suggestedTags": []
}
```

Rules:

* Do not create unsafe, illegal, or prohibited Offers.
* Keep the user responsible for final confirmation.
* Do not imply business verification unless verified.

### 7. Draft Trade

Examples:

```txt
Create a Trade where I need product photos and I offer dinner for two.
Create a Trade where I need logo design and offer social media help.
```

Provider:

```txt
Primary: OpenAI small/mid model
Fallback: Gemini
```

Output:

```json
{
  "need": {
    "title": "",
    "description": "",
    "category": "",
    "mode": "",
    "suggestedTags": []
  },
  "offer": {
    "title": "",
    "description": "",
    "category": "",
    "mode": "",
    "suggestedTags": []
  },
  "tradeTitle": "",
  "notes": []
}
```

Rules:

* Draft only.
* Do not publish automatically.
* Do not include wallet, payout, or in-platform money unless money features are explicitly enabled.
* One-to-one Trade rules apply unless multi-person features are enabled.

### 8. Proposal Helper

Examples:

```txt
Help me write a proposal.
Make this proposal polite.
Write a short message asking to trade.
```

Provider:

```txt
Primary: Gemini or OpenAI small/mid model
Fallback: Groq for simple rewrite
```

Output:

```json
{
  "message": "",
  "tone": "clear"
}
```

Rules:

* Keep it human and honest.
* Do not pressure the other user.
* Do not include contact details unless the user wrote them.
* Do not promise skills the user did not mention.

### 9. Category and Tag Suggestions

Examples:

```txt
Suggest tags for this Need.
What category should this Offer use?
```

Provider:

```txt
Primary: Groq or Gemini
Fallback: OpenAI small model
```

Output:

```json
{
  "category": "services",
  "tags": ["photography", "restaurant", "local"]
}
```

Rules:

* Use existing app categories.
* Do not create too many tags.
* Keep suggestions editable.

### 10. Summaries

Examples:

```txt
Summarize this Trade.
Summarize this support issue.
Summarize this proposal thread.
```

Provider:

```txt
Primary: Gemini or OpenAI small/mid model
Fallback: Groq for short/simple summaries
```

Use cases:

* user support
* admin review
* dispute preparation
* trade recap
* proposal comparison

Rules:

* Do not decide disputes automatically.
* Do not make final admin decisions.
* Clearly separate summary from judgment.

### 11. Moderation Check

Examples:

```txt
Check Need text before posting.
Check Offer text before posting.
Check proposal message.
Check uploaded media metadata/context.
```

Provider:

```txt
Primary: OpenAI moderation
```

Rules:

* Moderation should run before or after AI writing depending on the task.
* AI-generated text should still be checked if it will be posted.
* Flagged content should not be auto-approved.
* Use admin review for unclear cases.

## Suggested Routing Table

```txt
support_navigation:
  primary: rules
  fallback: groq

support_answer:
  primary: gemini
  fallback: groq

rewrite_need_title:
  primary: groq
  fallback: gemini

rewrite_need_description:
  primary: gemini
  fallback: openai

rewrite_offer_title:
  primary: groq
  fallback: gemini

rewrite_offer_description:
  primary: gemini
  fallback: openai

draft_need:
  primary: openai
  fallback: gemini

draft_offer:
  primary: openai
  fallback: gemini

draft_trade:
  primary: openai
  fallback: gemini

proposal_helper:
  primary: gemini
  fallback: openai

category_suggestions:
  primary: groq
  fallback: gemini

tag_suggestions:
  primary: groq
  fallback: gemini

trade_summary:
  primary: gemini
  fallback: openai

support_ticket_summary:
  primary: gemini
  fallback: openai

admin_summary:
  primary: openai
  fallback: gemini

moderation_check:
  primary: openai_moderation
```

## Plan-Based Access

AI access can vary by plan.

### Free

Possible AI features:

* simple support assistant
* navigation help
* basic FAQ answers
* limited title/description improvement
* limited category/tag suggestions

Possible limits:

```txt
Free:
  support messages/month: low
  writing assists/month: low
  full draft generation: disabled or very limited
```

### Plus

Possible AI features:

* everything in Free
* more support messages
* better writing assists
* Need draft generation
* Offer draft generation
* proposal helper
* more category/tag suggestions

Possible limits:

```txt
Plus:
  support messages/month: medium
  writing assists/month: medium
  full drafts/month: limited
```

### Pro

Possible AI features:

* everything in Plus
* Trade draft generation
* multi-person Trade planning
* reusable templates
* proposal comparison
* trade summaries
* analytics summaries

Possible limits:

```txt
Pro:
  support messages/month: higher
  writing assists/month: higher
  full drafts/month: higher
  advanced planning: enabled
```

### Business

Possible AI features:

* everything in Pro
* business catalog drafts
* campaign Need drafts
* voucher/perk copy drafts
* brand response templates
* admin/support summaries
* team workflow assistance

Possible limits:

```txt
Business:
  limits based on plan, usage, and risk review
```

## Usage Limits

AI must have strict usage limits.

Recommended limit types:

* per-user daily limit
* per-user monthly limit
* per-IP limit
* per-account risk limit
* max input length
* max output length
* max tasks per minute
* max cost per user per month
* max cost per plan per month
* admin kill switch

Example config:

```txt
AI_ENABLED=false
AI_FREE_ENABLED=false
AI_PLUS_ENABLED=false
AI_PRO_ENABLED=false
AI_BUSINESS_ENABLED=false

AI_MAX_INPUT_CHARS_FREE=1500
AI_MAX_INPUT_CHARS_PLUS=4000
AI_MAX_INPUT_CHARS_PRO=8000

AI_FREE_SUPPORT_MESSAGES_PER_MONTH=20
AI_FREE_WRITING_ASSISTS_PER_MONTH=5

AI_PLUS_SUPPORT_MESSAGES_PER_MONTH=200
AI_PLUS_WRITING_ASSISTS_PER_MONTH=50
AI_PLUS_FULL_DRAFTS_PER_MONTH=20

AI_PRO_SUPPORT_MESSAGES_PER_MONTH=500
AI_PRO_WRITING_ASSISTS_PER_MONTH=150
AI_PRO_FULL_DRAFTS_PER_MONTH=75
```

Exact numbers can change later.

## Cost Controls

AI cost must be measurable.

Log each AI request with:

* user id
* plan
* task type
* provider
* model
* input token estimate
* output token estimate
* cost estimate
* success/failure
* moderation status
* created time

Do not log sensitive data unnecessarily.

Use redaction where needed.

## Caching

Some support questions should not call AI every time.

Cache common answers for:

```txt
Where is support?
How do I create a Need?
How do I create an Offer?
How do proposals work?
Can I use money?
Where is settings?
How do I edit my profile?
```

Use rules or static help content first.

Then fallback to AI only when needed.

## Safety Rules

AI must not:

* publish content without user confirmation
* accept or decline proposals automatically
* negotiate for users automatically
* decide disputes
* verify identity
* verify businesses
* approve payouts
* approve money access
* bypass moderation
* bypass platform rules
* claim unsupported features are active
* encourage unsafe off-platform payments
* generate prohibited goods/services content

AI should:

* help users write clearly
* keep content honest
* preserve user intent
* flag uncertainty
* ask for review before saving
* follow Hellowhen product rules
* respect feature flags

## User Confirmation Rule

For generated Needs, Offers, Trades, and proposals:

```txt
AI creates a draft.
User reviews.
User edits if needed.
User confirms.
Only then can it be saved or posted.
```

Never auto-post AI-generated marketplace content.

## Feature Flags

AI features should be controlled by feature flags.

Examples:

```txt
AI_SUPPORT_ENABLED=false
AI_REWRITE_NEED_ENABLED=false
AI_REWRITE_OFFER_ENABLED=false
AI_DRAFT_NEED_ENABLED=false
AI_DRAFT_OFFER_ENABLED=false
AI_DRAFT_TRADE_ENABLED=false
AI_PROPOSAL_HELPER_ENABLED=false
AI_MODERATION_ENABLED=false
```

AI feature flags should work independently from plan flags.

## Backend Architecture

Recommended modules:

```txt
apps/api/src/modules/ai/
  ai.routes.ts
  ai.service.ts
  ai.router.ts
  ai.providers.ts
  ai.types.ts
  ai.limits.ts
  ai.prompts.ts
  ai.logging.ts
  providers/
    groq.provider.ts
    gemini.provider.ts
    openai.provider.ts
    openai-moderation.provider.ts
```

Recommended route examples:

```txt
POST /ai/support
POST /ai/rewrite/need
POST /ai/rewrite/offer
POST /ai/draft/need
POST /ai/draft/offer
POST /ai/draft/trade
POST /ai/proposal
POST /ai/tags
POST /ai/moderate
```

Routes should check:

* auth
* feature flag
* plan access
* rate limits
* input validation
* moderation where needed

## Prompt Rules

Prompts should include:

* task type
* user plan
* enabled product features
* disabled product features
* current beta/money rules where relevant
* user input
* expected output schema
* safety constraints

Prompts should not include unnecessary private data.

## Structured Output

Prefer structured JSON output for product actions.

Examples:

```json
{
  "title": "Need product photos for a handmade candle shop",
  "description": "I need clean product photos for my handmade candles. The photos should work for my website and social media.",
  "category": "services",
  "mode": "local",
  "suggestedTags": ["photography", "product", "local"],
  "questionsForUser": [
    "How many products do you want photographed?",
    "Do you need edited images?"
  ]
}
```

The backend should validate AI output before sending it to the app.

## Frontend UX

AI should appear as an assistant, not as an automatic decision-maker.

Recommended UI patterns:

* “Improve with AI”
* “Draft with AI”
* “Suggest title”
* “Suggest tags”
* “Help me write this”
* “Ask Hellowhen Help”
* “Use this draft”
* “Regenerate”
* “Edit before saving”

Avoid UI copy like:

* “AI will create the perfect Trade”
* “AI will find the best person”
* “AI will decide who is right”
* “AI verified this user”

## Data Privacy

AI requests may include user-generated content.

Rules:

* send only necessary content
* avoid sending private profile data unless required
* avoid sending full conversations unless summarization is requested
* redact sensitive fields where possible
* do not expose API keys to clients
* allow admin kill switch
* document AI usage in privacy policy before public release

## Admin Controls

Admin should eventually see:

* AI usage by user
* AI usage by task
* AI cost estimate
* flagged AI outputs
* failed AI requests
* users hitting AI limits
* provider/model health
* feature flag status

Admin should be able to:

* disable AI globally
* disable AI for a user
* disable a specific task
* change provider/model config
* lower limits
* block abusive usage

## Summary

Hellowhen should use AI through a task router.

```txt
Rules/no AI:
  simple navigation and known app actions

Groq:
  simple support, fast help, cheap classification

Gemini:
  balanced support, rewriting, tags, scalable writing help

OpenAI:
  higher-quality drafts, structured generation, proposal writing, moderation

OpenAI Moderation:
  safety checks
```

The goal is:

```txt
Use AI where it helps.
Keep users in control.
Keep costs predictable.
Keep marketplace safety stronger.
Do not expose future features before they are enabled.
```
