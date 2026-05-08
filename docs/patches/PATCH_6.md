# Patch 6 — Semantic UI Colors + Reusable Badges/Notices

Patch 6 adds a shared semantic color language for Hellowhen so users can quickly understand what each UI element means before Stripe or more complex money flows are introduced.

## Semantic colors

- Need: blue
- Offer: green
- Trade: purple
- Proposal: teal
- Time/deadline: orange
- Credits: gold
- Instruction: indigo
- Information: sky blue
- Success: green
- Warning: amber
- Danger: red
- Admin/moderation: slate
- Muted/inactive: gray

## Added mobile components

- `SemanticBadge`
- `StatusBadge`
- `CreditPill`
- `InfoNotice`

## Applied to mobile

- Login semantic intro
- Trades deck header/card
- Trade detail status, credit, role, expiry, proposal, and action states
- Create Need / Offer / Trade guidance
- Proposal detail conversations
- Needs and Offers list cards
- Account wallet metrics and ledger entries
- Media strip review statuses
- Image picker review notice

## Applied to web admin

- Admin media review page now uses semantic CSS variables and badges.
- Media review statuses are visually distinct: active/success, pending-review/warning, flagged/danger, removed/admin.

## Scope intentionally not included

- No Stripe
- No payouts
- No real-money flows
- No advanced admin dashboard
- No AI moderation
- No global messaging redesign
