# Content language resolution audit

LANG-AUDIT1 records the runtime rule, covered surfaces, and known follow-up gaps for creator-provided translations.

## Resolution rule

Every content surface should resolve copy in this order:

1. Viewer app language.
2. Viewer ordered content-language preferences.
3. Creator default/original language.
4. First available creator/manual translation.
5. Later only: approved machine translation, labelled as machine translated.

The shared implementation lives in `packages/shared/src/contentLanguageResolver.ts`. Inventory-like content should use `resolveInventoryDisplayCopy` / `withResolvedInventoryDisplay` from `packages/shared/src/inventoryTranslations.ts` instead of implementing its own fallback order.

## Data model

`UserSettings.contentLanguageOrder` stores the viewer preference order as JSON. The current supported content languages are `en`, `fr`, and `es`.

Creator content keeps `defaultLanguage` as the original/source language. Manual translations keep their own `languageCode`.

## API coverage

| Area | Current status | Notes |
| --- | --- | --- |
| Settings | Covered | API normalizes invalid/duplicate values and always returns an ordered list. |
| Trade feed | Covered | Need/Offer cards are resolved before the response is sent. |
| Trade detail | Covered | Need/Offer detail responses include language metadata and language options. |
| My trades | Covered | Owner/involved trade lists receive the same resolver metadata. |
| Place library / My places | Covered | Reusable places are resolved with viewer preferences. |
| Plan cards/detail | Partially covered | UI consumes `displayLanguage` from Plan Places/source Places. A later API pass should resolve custom PlanPlace title/note snapshots directly when PlanPlace-specific translations exist. |
| Public discussion messages | Not covered | Messages are single-language free text for now; add translation metadata only with a dedicated thread-language feature. |

## UI rule

Cards should stay compact. Show a language chip only when the displayed language is not an exact viewer-language match.

Detail pages should show a badge/switcher when:

- more than one creator language is available, or
- the viewer's first requested language is not available and a fallback language is shown.

## Audit command

Run:

```bash
npm run language:audit
```

The script performs static checks for the shared resolver, settings model/API/UI, API response adapters, card badges, and detail-page switchers. It can warn for intentionally tracked gaps but should fail when a covered surface loses the shared resolver or display-language metadata.

## Follow-up recommendations

- Add PlanPlace-specific translations before resolving custom PlanPlace title/note snapshots directly in the API.
- Add API-side smoke fixtures for `viewer=es`, `contentLanguageOrder=[es,fr,en]`, `available=[en,fr]` returning French.
- Keep machine translations out of the creator/manual fallback path until they can be labelled and reviewed.
