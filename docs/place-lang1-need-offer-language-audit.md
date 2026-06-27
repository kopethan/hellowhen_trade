# PLACE-LANG1 — Need/Offer language behavior audit

## Scope

This audit documents how Create/Edit Need and Create/Edit Offer currently handle original language and manual translations. It is intentionally docs-only: no product behavior is changed in this patch.

Audited areas:

- `apps/mobile/src/features/trade/InventoryCreateWizardScreen.tsx`
- `apps/mobile/src/features/trade/InventoryDetailScreen.tsx`
- `apps/mobile/src/features/trade/CreateNeedFullScreen.tsx`
- `apps/mobile/src/features/trade/CreateOfferFullScreen.tsx`
- `apps/mobile/src/features/trade/components/InventoryFormFields.tsx`
- `apps/web/src/features/inventory/InventoryCreateWizardClient.tsx`
- `apps/web/src/features/inventory/InventoryFormClient.tsx`
- `apps/web/src/features/inventory/inventoryPresentation.ts`
- `apps/api/src/modules/needs/needs.routes.ts`
- `apps/api/src/modules/offers/offers.routes.ts`
- `apps/api/src/modules/inventoryTranslations.ts`
- `packages/contracts/src/trade.ts`
- `packages/shared/src/inventoryTranslations.ts`
- `packages/i18n/src/locales/*/inventory.ts`

## Current Need/Offer behavior

### 1. Supported content languages

Need/Offer inventory translations support three discovery languages:

- `en`
- `fr`
- `es`

This is shared across mobile and web UI via `inventoryLanguageOptions` and validated in contracts through `discoveryLanguageSchema`.

### 2. Original language

Need/Offer items store their original content language in `defaultLanguage`.

Backend defaults:

- Need create defaults `defaultLanguage` to `en` when omitted.
- Offer create defaults `defaultLanguage` to `en` when omitted.
- Need/Offer update can update `defaultLanguage` when explicitly provided.

UI defaults:

- Mobile Create Need/Offer wizard initializes original language from the current app language.
- Mobile Edit Need/Offer hydrates original language from `item.defaultLanguage`, falling back to current app language if missing.
- Web Create Need/Offer wizard resets drafts with `defaultLanguage` set to the current UI language.
- Web edit/full form hydrates `defaultLanguage` from the item.

User-facing label pattern:

- Section title: `Languages`
- Helper copy: original text stays in the account language by default; add another language only when writing a manual translation.
- Original language summary: `Original content: English/French/Spanish`

### 3. Manual translation is optional

Need/Offer translation is not forced.

Mobile wizard:

- Translation is behind a compact/collapsed card.
- It starts closed unless a restored draft already has translation fields.
- The user taps `Manual translation` / `Add language` to reveal translation fields.

Mobile full/edit screens:

- Translation appears as a language section.
- It shows original language summary first.
- Translation fields only appear after the user adds/enables translation.

Web wizard:

- Translation is behind a collapsible panel.
- It starts open only if a draft/template has translation content.
- Otherwise users see a compact `Manual translation` affordance.

Web full/edit form:

- Translation has a visible language panel, but translation fields appear only after a language is added.

### 4. Translation language selection

Web supports choosing any available non-original language from `en`, `fr`, and `es`.

Mobile currently supports one editable alternate language at a time:

- If original language is `fr` or `es`, the suggested translation language is `en`.
- If original language is `en`, the suggested translation language is `fr`.

This is produced by `getAlternateInventoryLanguage(defaultLanguage)`.

Implication:

- Web can add multiple translation languages.
- Mobile only exposes a single suggested translation language in the current compact flow.

### 5. Empty translation fields

The backend treats translations as optional and ignores empty translations.

Backend normalization:

- Translations with the same language as `defaultLanguage` are ignored.
- Translations without both title and description are ignored.
- Duplicate language entries are deduped by language, with the last entry winning.
- When translations are sent on update, removed languages are deleted.
- When `translations` is omitted on update, existing translations are left unchanged.
- When `translations: []` is sent on update, existing translations are removed.

Frontend validation is stricter before sending:

- If title is filled and description is empty, show `translationIncomplete`.
- If description is filled and title is empty, show `translationIncomplete`.
- If a translated title is present, it must meet the same title minimum length as the original.
- If a translated description is present, it must meet the same description minimum length as the original.

This means users may leave translation completely empty, but cannot save a partial manual translation.

### 6. Display fallback language

Feed/detail display resolution is backend-driven for public Trade data.

Rules from shared display helper:

1. Resolve `defaultLanguage`, falling back to `en`.
2. Resolve viewer/requested language, falling back to the default language.
3. If viewer language equals original language, show original title/description.
4. If a complete translation exists for viewer language, show translated title/description.
5. Otherwise show original title/description.

Important limitation:

- The display helper replaces `title` and `description` with resolved copy but does not expose separate display metadata such as `displayLanguage` or `isTranslated` in the returned DTO.

### 7. Moderation and review

Need/Offer moderation uses the original item language:

- `moderationLocale(defaultLanguage)` is passed to AI text review.
- Manual translation title/description are included in moderation extra text/message.

This is good because translated copy still enters review context.

## Current Place language behavior compared with Need/Offer

Place uses the same backend translation table and `targetType: "place"`, which is good.

However, Place UI does not fully match Need/Offer UX yet:

- Place language labels are mostly hardcoded in English in mobile/web Plan files.
- Place exposes original language chips directly in the form rather than using the shared Need/Offer language wording.
- Place translation add/remove UI is similar in concept, but not fully localized through the existing `inventory.form.*` keys.
- Place validation uses hardcoded messages instead of shared inventory translation error labels.
- Place can add multiple languages on web/mobile using local place helpers, while mobile Need/Offer exposes only the single alternate language helper.

## Recommended PLACE-LANG2 direction

PLACE-LANG2 should align Place UX with Need/Offer without changing database structure.

Recommended changes:

1. Reuse Need/Offer language copy where possible:
   - `inventory.form.languageTitle`
   - `inventory.form.languageBody`
   - `inventory.form.originalContentLanguage`
   - `inventory.form.chooseTranslationLanguage`
   - `inventory.form.manualTranslationFor`
   - `inventory.form.translationHelp`
   - `inventory.actions.addLanguage`
   - `inventory.actions.removeTranslation`
   - `inventory.errors.translationIncomplete`
   - `inventory.errors.translationTitleTooShort`
   - `inventory.errors.translationDescriptionTooShort`

2. Keep Place original language simple:
   - Default to current UI language for new user Places.
   - Show a compact original language summary.
   - Do not force users to think about language during simple Place creation.

3. Keep Place translation optional/collapsed:
   - Do not show translation fields until the user adds a language.
   - If a user removes a translation, clear it from payload.
   - Empty translation should mean no translation.

4. Keep backend behavior unchanged:
   - Continue using `InventoryTranslation` with `targetType: place`.
   - Continue using `syncInventoryTranslations`.
   - No migration needed.

5. Decide mobile language capacity deliberately:
   - Option A: align Place mobile with Need/Offer and expose only one suggested alternate language.
   - Option B: improve Need/Offer mobile later to support choosing multiple translation languages like web.

Recommendation for first launch:

- Use Option A for PLACE-LANG2 to stay consistent and simple.
- Later, a separate inventory-language enhancement can make mobile Need/Offer and Place support multiple manual translation languages equally.

## Risks to avoid in PLACE-LANG2

- Do not introduce auto-translation.
- Do not force translation fields before saving a Place.
- Do not change existing Need/Offer translation payload semantics.
- Do not change `InventoryTranslation` schema.
- Do not show a translation language equal to the original language.
- Do not silently delete existing translations unless the user explicitly removes them or sends an empty translation selection during edit.

## Conclusion

Need/Offer language behavior is mature enough to use as the model for Place:

- Original language is stored as `defaultLanguage`.
- Manual translations are optional.
- Empty translations are ignored.
- Partial translations are blocked by UI validation.
- Display falls back to original content when no complete viewer-language translation exists.
- Moderation includes translation text.

PLACE-LANG2 should be a UI/i18n alignment patch for Place, not a schema or API redesign.
