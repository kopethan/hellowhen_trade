# Content Intelligence AI suggestions (admin-only)

Patch C4 adds an optional AI suggestion layer on top of the rule-based Content Intelligence foundation.

## First-launch default

All AI behavior remains disabled by default:

```env
AI_ENABLED=false
AI_PROVIDER=none
AI_SUGGESTIONS_ENABLED=false
AI_ADMIN_ASSIST_ENABLED=false
AI_MODERATION_SUGGESTIONS_ENABLED=false
AI_PRIVATE_CONTENT_ENABLED=false
```

With those defaults:

- no external AI provider is called,
- no user-facing AI behavior exists,
- no public labels are shown,
- no public category is changed,
- no content is hidden automatically,
- no user is banned, deleted, or restricted automatically.

The admin page may show an AI suggestion button, but it is disabled unless the full admin-only AI configuration is enabled.

## Later admin-only configuration

For a private admin test, enable all of these together:

```env
CONTENT_INTELLIGENCE_ENABLED=true
CONTENT_CLASSIFICATION_ENABLED=true
AI_ENABLED=true
AI_PROVIDER=openai # or gemini or groq
AI_SUGGESTIONS_ENABLED=true
AI_ADMIN_ASSIST_ENABLED=true
AI_MODERATION_SUGGESTIONS_ENABLED=true
AI_PRIVATE_CONTENT_ENABLED=false
```

Then configure exactly one provider key/model pair, for example:

```env
OPENAI_API_KEY=...
OPENAI_CONTENT_SUGGESTION_MODEL=gpt-4o-mini
```

or:

```env
GEMINI_API_KEY=...
GEMINI_CONTENT_SUGGESTION_MODEL=gemini-1.5-flash
```

or:

```env
GROQ_API_KEY=...
GROQ_CONTENT_SUGGESTION_MODEL=llama-3.1-8b-instant
```

## Admin workflow

1. Admin opens `/admin/content-intelligence`.
2. Admin selects an existing classification row, usually the `rules` source row.
3. Admin clicks **Generate AI suggestion**.
4. The API sends only the selected target text and current rule-based baseline to the configured provider.
5. The returned suggestion is stored as a separate `ContentClassification` row with `source=ai`.
6. Admin can compare the `rules` and `ai` rows, then mark reviewed or override stored suggestions.

## Safety rules

AI suggestions are recommendations only. They must not:

- automatically ban users,
- automatically delete content,
- automatically hide content,
- rewrite the user's public category,
- create public AI labels,
- enable ads, money, wallet, payouts, plans, Business, or Pro behavior.

Patch C4 deliberately stores AI output separately from admin decisions so that an admin can review, override, and audit the suggestion before any later workflow uses it.
