# Content Intelligence review gate

The Content Intelligence review gate is a hidden, admin-only safety layer for later moderation launches.

First-launch defaults keep the system in suggestion-only mode:

```env
CONTENT_INTELLIGENCE_ENABLED=false
CONTENT_CLASSIFICATION_ENABLED=false
AI_MODERATION_SUGGESTIONS_ENABLED=false
AUTO_MODERATION_ACTIONS_ENABLED=false
CONTENT_REVIEW_GATE_ENABLED=false
CONTENT_REVIEW_GATE_HIGH_RISK_ENABLED=false
CONTENT_REVIEW_GATE_CATEGORY_MISMATCH_ENABLED=false
CONTENT_REVIEW_GATE_SUGGESTED_HIDE_ENABLED=false
CONTENT_REVIEW_GATE_CLASSIFIER_FAILURE_ENABLED=false
```

## Behavior

When all required gate flags are explicitly enabled, rule-based classification can route newly public content into admin review:

- active Needs become `pending_review`
- active Offers become `pending_review`
- public Trades stay `active` but become `isPublic=false`

The gate does not:

- ban users
- delete content
- rewrite user categories
- expose public AI labels
- call any AI provider
- enable ads or money behavior

## Required switches

The gate only acts when all of these are true:

```env
CONTENT_INTELLIGENCE_ENABLED=true
CONTENT_CLASSIFICATION_ENABLED=true
CONTENT_REVIEW_GATE_ENABLED=true
AUTO_MODERATION_ACTIONS_ENABLED=true
```

Then enable one or more gate reasons:

```env
CONTENT_REVIEW_GATE_HIGH_RISK_ENABLED=true
CONTENT_REVIEW_GATE_SUGGESTED_HIDE_ENABLED=true
CONTENT_REVIEW_GATE_CATEGORY_MISMATCH_ENABLED=true
CONTENT_REVIEW_GATE_CLASSIFIER_FAILURE_ENABLED=true
```

`FIRST_LAUNCH_GUARDS_ENABLED=true` still blocks automatic moderation actions for the first launch.

## Review flow

Admins review gated content in:

- `/admin/content-intelligence` for classification reason, tags, category mismatch, and notes
- `/admin/content` for visibility/status actions such as restore/hide/close

The content owner can still see their own gated Need/Offer/Trade in owner areas, but it is not public-discoverable while pending or hidden.
