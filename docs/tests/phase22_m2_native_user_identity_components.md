# Phase 22.M2 — Native user identity components smoke checklist

Scope: shared native identity UI only. This phase should not replace trade/proposal name surfaces yet.

## Components

- `apps/mobile/src/features/users/UserAvatar.tsx`
  - Shows remote avatar when `src` is valid.
  - Falls back to the first display-name initial when the image is missing or broken.
  - Falls back to the first handle initial when display name is missing.
  - Falls back to `H` when both display name and handle are missing.
  - Resolves API-relative upload paths against `EXPO_PUBLIC_API_URL` / mobile API base URL.
  - Supports `xs`, `sm`, `md`, and `lg` sizes.

- `apps/mobile/src/features/users/UserIdentityPressable.tsx`
  - Shows avatar + display name.
  - Optionally shows handle/status/subtitle.
  - Navigates to `UserProfile` when `userId` is present.
  - Renders as static identity when `userId` is missing or disabled.
  - Stops press propagation by default so later use inside cards does not trigger parent card actions.
  - Supports `inline`, `chip`, `row`, and `compact` variants.

## Public profile screen refactor

- Public profile hero uses shared `UserAvatar`.
- Existing profile load/retry behavior remains unchanged.
- Public post cards still open `TradeDetail`.
- Active trades, open needs, and open offers render once each.

## Privacy

These components must not display email, phone, wallet, settings, support data, private proposals, or private messages.
