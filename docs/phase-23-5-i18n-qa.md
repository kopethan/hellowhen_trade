# Phase 23.5 — Final i18n audit and QA

## Scope

This pass cleaned remaining safe hardcoded app/system labels after the Phase 23.1–23.4 localization work.

Localized areas expanded in this pass:

- Web account page intro labels for account, wallet, add balance, payouts, and support.
- Web shell accessibility labels, deck navigation labels, trade tag labels, and legacy trade card/deck labels.
- Native profile editing labels, generic select sheet helper text, legacy My Trades placeholder, proposal creation labels, media strip labels, and older trade deck card labels.
- Shared English/French dictionaries for the new keys.

## Still intentionally not translated

These are intentionally left as raw text or data:

- Brand/product names: `Hellowhen`, `Hellowhen Trade`.
- Provider/product names: `Stripe`, `Stripe demo`.
- Beta flags and badges such as `BETA`/`Beta`.
- Demo/local placeholder values such as `Kopy` in profile input examples.
- Currency codes such as `EUR`, `USD`, `GBP`.
- User-generated content: trade titles, need/offer descriptions, user bios, proposal messages, conversation text, support ticket subjects/messages/replies, tags, and uploaded media data.
- Admin/internal screens and backend API error messages, which should be handled later with a stable error-code strategy.

## QA checks run

- `npm run typecheck -w @hellowhen/i18n`
- Translation parity check between English and French dictionaries.
- Literal translation-key check for `t('...')` calls across web and native source files.
- Targeted TS/TSX syntax transpile check for changed web/native files.
- Hardcoded JSX/string scan excluding admin/internal areas.

## Known validation limitation

Full web/native workspace typecheck was not run in the sandbox because external app dependencies are not installed in this extracted zip workspace.
