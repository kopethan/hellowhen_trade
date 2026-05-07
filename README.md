# Zizilia

Clean Trade-first product repo.

Zizilia is **not** a continuation of the old Plans app. The uploaded previous project is used only as a reference/source for reusable foundations:

- auth flow patterns
- me/profile and settings patterns
- theme tokens
- shared UI direction
- brand/icon asset approach
- API/token utility patterns

It intentionally does **not** migrate Plans, the old action bar, place/feed/deck complexity, lab screens, or old navigation assumptions.

## Product concept

Zizilia is focused on:

- Needs
- Offers
- Public Trade Feed
- Public Trade Detail for active trades
- Private My Needs / My Offers / My Trades owner management
- Fake credits wallet placeholder for MVP
- Mobile My Needs, My Offers, My Trades, and Trade Detail shells
- Web auth shell and future dashboard placeholder
- Ledger-first credit architecture for later real payment review

## Apps

```txt
apps/
  api/      Express + Prisma + PostgreSQL API
  mobile/   Expo / React Native mobile app
  web/      Next.js web app

packages/
  api-client/
  contracts/
  shared/
  theme/
  trade-domain/
  ui/
```

## Patch 1 status

Patch 1 creates the repo base structure, route placeholders, shared contracts, Trade domain types/rules, Prisma schema draft, and mobile/web shell screens.

Real-money payments are **not implemented**. Credits are fake/test only in this patch.

## Local start

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev:api
npm run dev:web
npm run dev:mobile
```

### Mobile API networking

Expo only exposes variables prefixed with `EXPO_PUBLIC_`. The mobile app reads
`EXPO_PUBLIC_API_URL` from `apps/mobile/.env`.

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Use the API URL that the device can reach:

- iOS simulator or local web: `http://127.0.0.1:4000`
- Android emulator: `http://10.0.2.2:4000`
- Physical phone: `http://<your-computer-lan-ip>:4000`

## Credit safety rule

Purchased credits and earned credits must stay separate:

- purchased credits = non-withdrawable spending balance
- earned credits = payout-eligible only after completion/hold period

All changes should be represented with ledger entries. Do not store only a wallet balance.
