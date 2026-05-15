# Trade-first launch freeze plan

This document records the first-launch scope before the project moves into security hardening.

The goal is to launch Hellowhen Trade as a focused, mobile-first marketplace for **Trades**, **Needs**, **Offers**, and **Account** only. Features that are not part of the first launch can exist in the codebase, but they must stay hidden, disabled, or test-only in production.

## First-launch product scope

Visible first-launch navigation:

- Trades
- Needs
- Offers
- Account

First-launch users should be able to:

- register or log in with supported first-launch authentication
- create and manage Needs
- create and manage Offers
- create Trades from Needs and Offers
- discover Trades in the feed/deck
- open Trade detail pages
- submit proposals
- accept or decline proposals as the Trade owner
- report unsafe or inappropriate content
- contact support
- request account deletion
- manage profile/settings/account basics

## Explicitly out of scope for first launch

The following must not be exposed in production launch navigation, launch screenshots, onboarding copy, or public marketing copy:

- Plans
- wallet / credit purchase flows
- payouts
- Stripe
- Airwallex
- money trades
- real-money escrow or stored balances
- paid guides or paid helpers
- Google sign-in
- teen accounts
- native Plans UI
- maps / Google Places
- notifications
- public chat

If routes or internal components already exist for future features, they must remain hidden behind feature flags, admin-only access, or safe disabled states.

## Plans freeze rules

Plans are a future hidden feature. For first launch:

- `PLANS_ENABLED=false` by default.
- `PLANS_VISIBLE=false` by default.
- `NEXT_PUBLIC_PLANS_ENABLED=false` by default.
- `NEXT_PUBLIC_PLANS_VISIBLE=false` by default.
- `EXPO_PUBLIC_PLANS_ENABLED=false` by default.
- `EXPO_PUBLIC_PLANS_VISIBLE=false` by default.
- Plans must not appear in main navigation.
- Plans must not appear in store screenshots or first-launch marketing.
- Local testing may enable Plans manually, but committed examples/defaults should stay disabled.

## Money freeze rules

First launch is service/goods/skill exchange only. For production launch:

- no wallet top-ups
- no credit purchases
- no payouts
- no payment provider integration enabled
- no real-money Trade creation
- no payout eligibility UI
- no real-money support promises

Money-related code or routes may remain for future work, but production behavior must be disabled or safely inaccessible to normal users.

## Authentication and age rules

First launch rules:

- 18+ only.
- No teen accounts.
- Google sign-in remains disabled unless a later launch decision enables it.
- Account deletion request flow stays available.
- Support/admin review may retain reports, moderation notes, security logs, support records, and audit records where required for safety, legal, abuse-prevention, or operational reasons.

## Trade smoke test before security hardening

Run a manual smoke test after the freeze patch set and before deeper security work:

1. Register a new user.
2. Log in and log out.
3. Create a Need.
4. Create an Offer.
5. Create a Trade from a Need and an Offer.
6. Confirm duplicate Trade prevention still shows a user-facing message.
7. View the Trade feed deck.
8. Open Trade detail.
9. Submit a proposal from another user.
10. Accept a proposal as the Trade owner.
11. Decline a proposal as the Trade owner.
12. Report a Trade, Need, Offer, profile, or unsafe content surface where available.
13. Submit a support request.
14. Request account deletion.
15. Cancel account deletion before final processing.
16. Confirm restricted/suspended users cannot create or propose if admin tooling marks them restricted.

## Mobile-web first impression checklist

Because the first launch may be web-first, test on mobile browser sizes:

- bottom tabs fit and stay reachable
- Trade deck size matches the intended mobile-first card size
- Trade cards truncate long titles/descriptions safely
- Need/Offer cards truncate long text safely
- create Need form is simple and not overwhelming
- create Offer form is simple and not overwhelming
- create Trade picker pages return selected Need/Offer correctly
- image upload preview works
- Trade detail does not overflow horizontally
- proposal flow is understandable
- Account, Settings, Support, Legal, and Delete Account are reachable
- dark mode persists without obvious light flash
- no hidden Plans entry appears when flags are false
- no money/wallet/payout action appears in first-launch production mode

## Repo health checkpoint

Latest reported local checks:

- `npm install` completed successfully.
- `npm run prisma:validate` passed.
- `npm run typecheck` passed across workspaces.
- `npm run build -w @hellowhen/web` passed.
- `npm run build -w @hellowhen/api` passed.
- Root `npm run lint` is currently missing because there is no root `lint` script.
- `npm install` reported 23 vulnerabilities: 1 low, 9 moderate, 13 high.

Before production launch, resolve or explicitly risk-accept the audit findings. Do not run `npm audit fix --force` blindly because it can introduce breaking dependency updates.

Recommended security-phase follow-up:

- add a root `lint` script or document why linting is workspace-specific
- run `npm audit` and classify each finding
- update safe dependencies where possible
- avoid breaking dependency upgrades without a dedicated test pass

## Route visibility checkpoint

The web build may include routes for future or hidden features, including Plans, wallet, credits, money, payouts, and admin areas. For first launch, route existence is not enough to block launch, but production behavior must be safe:

- hidden features should not be linked from normal navigation
- disabled features should show a safe unavailable state or redirect
- admin routes must require admin authorization
- money routes must not allow real purchase, payout, wallet, or money Trade actions
- Plans routes must stay hidden/disabled unless local feature flags are intentionally enabled

## Security phase entry criteria

Move into security hardening after:

- first-launch scope is documented and accepted
- Plans are frozen behind flags
- money features are disabled for launch
- Trade smoke test passes
- mobile-web first impression is acceptable
- Prisma validation and typecheck pass
- web and API builds pass

## Next security focus

The next implementation area should prioritize:

- auth/session safety
- API authorization checks
- restricted/suspended user enforcement
- upload/media validation and serving safety
- rate limits
- report/support abuse protection
- admin route permissions
- production environment hardening
- backup and restore plan
- dependency audit triage
- deployment firewall and secret management
