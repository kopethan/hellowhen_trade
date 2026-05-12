# Phase 23.6 — Language runtime QA and French copy polish

## Scope

This pass focused on runtime-visible localization issues after the broader Phase 23.1–23.5 rollout. It did not change routes, app visuals, feed/deck behavior, proposal logic, wallet/money logic, or public profile behavior.

## Runtime-facing fixes

- Improved web pre-hydration language resolution so `system` language checks the browser locale candidate list instead of only the first browser language.
- Web now keeps both `html[lang]` and `html[data-language]` in sync with the resolved app language.
- Added shared localized country/currency labels for the registration and profile local-display selectors.
- Localized web auth tab accessibility text and disabled Google sign-in tooltip.
- Localized default web confirm-dialog action text and loading text.
- Localized native deck previous/next accessibility labels.
- Switched native trade expiry labels to shared locale-aware relative-time formatting with dictionary fallbacks.
- Switched native inventory updated-date formatting to the shared selected-language date formatter.

## French copy polish

- Replaced remaining French ASCII ellipses with the French ellipsis character where the copy is user-facing.
- Improved wallet/payout copy around roadmap features, money-trade wording, platform fee wording, and sensitive-action verification.
- Replaced awkward French labels such as `Expiration ouverte`, `Tags de l’échange`, and `argent production` with clearer product copy.
- Added French country/currency names for currently supported local-display options.

## Checks run

- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run typecheck -w @hellowhen/i18n`
- `npm run typecheck -w @hellowhen/web`
- `npm run typecheck -w @hellowhen/mobile`
- English/French dictionary key parity check.
- English/French interpolation-token parity check.
- Literal `t('...')` key check across web and native source.
- Node-based i18n runtime smoke test for:
  - `system` language resolution from `fr-FR`, `en-US`, and unsupported locales
  - French navigation translation
  - French country translation
  - French money/date formatting
  - French relative expiry formatting
- Targeted TS/TSX transpile syntax check for changed files.

## Build/typecheck notes

- Web typecheck passed.
- Mobile typecheck passed.
- The web Next build compiled successfully and printed the completed route table, but the sandbox command did not exit before the timeout.
- Full workspace typecheck is still blocked on API Prisma client generation because Prisma attempted to download query-engine binaries from `binaries.prisma.sh`, which was unavailable in the sandbox (`EAI_AGAIN`).

## Still intentionally not localized

- User-generated content: trade titles, need/offer descriptions, bios, proposal messages, conversation messages, support ticket content, tags, and uploaded media data.
- Brand/provider names such as Hellowhen, Stripe, Airwallex, and Google.
- Admin/internal pages and backend API error messages.
- Demo/beta/product flag identifiers where they function as internal/debug labels.
