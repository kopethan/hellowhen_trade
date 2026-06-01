# Content Intelligence contextual placement signals

Patch C5 adds hidden internal records for future contextual matching. It does not enable ads, sponsored placements, tracking, public labels, automatic category changes, automatic hiding, automatic deletion, or automatic user sanctions.

## Flags

Keep all of these disabled for first launch:

```env
CONTENT_PLACEMENT_SIGNALS_ENABLED=false
BUSINESS_CONTEXTUAL_SIGNALS_ENABLED=false
CONTEXTUAL_AD_SIGNALS_ENABLED=false
```

The admin sync action is available only when `CONTENT_INTELLIGENCE_ENABLED=true`, `CONTENT_CLASSIFICATION_ENABLED=true`, and `CONTENT_PLACEMENT_SIGNALS_ENABLED=true` are enabled in a non-public/internal environment.

`BUSINESS_CONTEXTUAL_SIGNALS_ENABLED` is reserved for a later Business sponsored-content launch. `CONTEXTUAL_AD_SIGNALS_ENABLED` is reserved for a later contextual ads launch and still does not perform ad serving by itself.

## Data model

`ContentPlacementSignal` stores an admin-reviewed snapshot derived from a `ContentClassification` row:

- target type/id
- approved domain category
- approved tags
- safety metadata
- eligibility booleans for future contextual matching
- disabled reason when content is unsafe or not ready
- admin/user audit fields

Signals are unique by `targetType + targetId`, so a later admin override can replace the old signal snapshot.

## Eligibility rule

A signal can become `active` only when the source classification is reviewed or overridden and has no safety blockers:

- no unresolved category mismatch
- no high/critical safety severity
- no adult/sexual/violence/hate/self-harm/illegal/spam category
- no adult, spam/scam, or regulated risk flags
- suggested action is `allow`
- system category exists

Otherwise the signal is stored as `disabled` with a reason. This lets admins see why an item is not eligible for future matching without hiding or deleting the item.

## Admin flow

From `/admin/content-intelligence`:

1. Review or override a classification.
2. Use **Sync placement signal**.
3. The API stores or updates a hidden `ContentPlacementSignal` row.
4. An admin audit-log entry records the change.

This is intentionally an explicit admin action. C5 does not automatically sync signals on every classification update.

## Privacy and first-launch safety

Signals are contextual: category and tag based. They are not personal tracking profiles and are not shown to users.

For first launch, production guards still fail if placement/ad signal flags are enabled. Business sponsored content, ads, and contextual ad signals remain disabled by default.
