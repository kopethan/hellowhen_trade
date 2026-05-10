# Phase 23.0F — Final Smoke Test Report

Repo tested: `hellowhen_trade_phase23_0E_media_policy.zip`

## Result

Conditional pass after applying the included 23.0F smoke-fix patch.

The static smoke checklist passed 34/34 checks after the final cleanup patch.

## Smoke-fix patch included

Files changed:

- `apps/api/src/modules/proposals/proposals.routes.ts`
- `apps/mobile/src/features/trade/ProposalDetailScreen.tsx`
- `apps/mobile/src/features/trade/components/ImagePickerField.tsx`

Fixes:

- Hides legacy money-linked proposal threads while beta money is off.
- Blocks proposal detail, status update, message list, and message send for legacy money-linked proposals.
- Removes remaining visible wallet-money copy from mobile Proposal Detail.
- Renames the mobile image field info prop from `reviewBody` to `infoBody` to match the immediate-visibility media policy.

## Static smoke checklist

Passed:

- API `/credits`, `/wallet`, and `/business` are feature-gated.
- Default API money flags keep money/wallet/payout/business hidden.
- Create Trade rejects money/credit/wallet payloads when beta money is off.
- New beta trades force `creditAmount: 0`.
- Proposal APIs hide legacy money-linked proposal threads after smoke fix.
- Web middleware redirects hidden direct money/business/admin-money routes.
- Credits success/cancel pages redirect to Account.
- Seed data no longer creates wallets or demo credit grants.
- Seed trades are Need + Offer only with zero money fields.
- Seed support ticket uses `trade_issue`.
- Media uploads are active immediately.
- Public trade media renders active-only media.
- Mobile tabs remain Trades, Needs, Offers, Account.
- Mobile wallet/payout/business routes are feature-gated.
- Web mock/demo fallback is gated by explicit demo settings.

## Validation run

- `patch --dry-run -p2 < phase23_0F_final_smoke_fix.patch` passed against the 23.0E repo.
- `git diff --check --no-index` reported no whitespace problems.
- Typecheck could not complete because dependencies are missing in the extracted repo: `express`, `react`, `next`, `zod`, `@types/node`, and related package types.

## Remaining note

Source code still contains roadmap wallet/credits/payout/admin components behind feature flags and middleware/API gates. They are not launch-visible with default beta flags, but a future cleanup phase can delete or move them behind a separate roadmap folder if desired.
