# Zizilia architecture

`zizilia` is a clean monorepo with three apps and shared packages.

```txt
apps/api      Express + Prisma + PostgreSQL
apps/mobile   Expo / React Native
apps/web      Next.js
```

Shared packages hold contracts, API client utilities, theme tokens, UI primitives, and Trade domain rules.

## Reuse policy

The uploaded previous project is used only as reference for auth/profile/settings/theme/UI patterns.

Do not import or copy old Plans, action bar, deck/feed/place, polls, messages, talk, lab screens, or old navigation assumptions.

## Core rule

Zizilia is Trade-first:

- public feed contains active public trades
- needs are private to their owner
- offers are private to their owner
- owner trade management is private
- active trade detail can be public
- credits are fake/test only until legal/payment review
