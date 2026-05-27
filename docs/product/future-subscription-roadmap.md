# Future Subscription Roadmap

## Status

This document is for future planning only.

The first beta launch is **Free only**. Do not expose subscription UI, upgrade prompts, professional onboarding, identity-verification prompts, pricing cards, or business-account onboarding during the first launch unless a later phase explicitly enables them.

Current roadmap decision:

```txt
Free   -> individual beta/default account
Plus   -> future non-professional individual upgrade, not defined for launch
Pro    -> one professional subscription tier, identity verification required
Business -> later business/brand account or upgrade, separate decision
```

## Product principle

Keep the core marketplace easy to join. Subscriptions should not block basic marketplace liquidity.

Do not charge users just to:

- create a basic Need
- create a basic Offer
- create a basic one-to-one Trade
- send a basic proposal
- participate in normal service/goods exchanges

Paid tiers should unlock optional value:

- professional trust and presentation
- workflow/productivity tools
- higher safe limits where appropriate
- better discovery/visibility tools
- analytics
- support enhancements
- business/brand tools later
- future money features only after legal, provider, and compliance readiness

## Safety rule

Paid users must not bypass safety.

A subscription must never automatically bypass:

- identity checks
- payment-provider checks
- KYC/KYB
- media review
- reports
- disputes
- anti-spam limits
- fraud/risk controls
- admin restrictions
- account suspension/restriction rules

Verification and trust checks are safety layers. Payment is not proof of safety.

## Account type vs subscription

Keep these concepts separate.

```txt
accountKind:
  individual
  business_later

subscriptionTier:
  free
  plus_later
  pro
  business_later

subscriptionStatus:
  none
  trialing
  active
  past_due
  canceled
  expired

professionalStatus:
  none
  pending_verification
  verified
  rejected
  suspended
```

Professional access is a combination of verification and subscription state:

```txt
Pro access = professionalStatus is verified
             AND subscriptionTier is pro
             AND subscriptionStatus is trialing or active
```

A user may be identity-verified but not have Pro access if the subscription is expired, canceled, past due, or not started.

## First launch rule

The first launch stays simple:

```txt
Free only
No Plus UI
No Pro UI
No Business UI
No pricing cards
No trial prompts
No subscription checkout
No identity-verification provider
No money/wallet/payout dependency
```

Hidden future flags may exist, but the default user experience must not change.

---

# Tier 1 — Free

## Purpose

Free is the core marketplace tier and the first beta/default account.

It allows users to understand and use Hellowhen Trade without payment.

## Included

- Create Needs
- Create Offers
- Create one-to-one Trades
- Send proposals
- Accept or decline proposals
- Basic profile
- Basic settings
- Basic support
- Service/goods/other exchanges
- No identity verification required by default
- Hidden anti-spam and safety limits

## Not included

- Professional profile tools
- Professional badge
- Portfolio/gallery tools
- Advanced analytics
- Priority discovery tools
- Business/brand tools
- Wallet
- Payouts
- In-platform money trades
- Payment-provider onboarding

## Trade scope

Free users can create normal one-to-one Trades:

```txt
Person A <-> Person B
```

Free should remain useful enough for marketplace liquidity, but it should not include professional positioning tools for free.

---

# Tier 2 — Plus

## Status

Plus is a future non-professional individual upgrade. It is not first launch scope and does not need implementation yet.

## Purpose

Plus may later serve users who want a better individual experience without becoming a professional account.

Potential Plus benefits could include:

- ad-free experience if ads are introduced later
- small productivity improvements
- higher non-professional safe limits
- extra saved items/searches
- extra support options
- limited AI assistance if AI is introduced later

## Boundary

Plus must not include professional features.

Plus should not include:

- professional badge
- professional profile positioning
- professional portfolio tools
- public claim of identity-verified professional status
- business/brand tools
- money access by default
- safety bypasses

Plus pricing, availability, and benefits are intentionally undecided.

---

# Tier 3 — Pro

## Decision

There should be **one Pro tier for professionals**, not several Pro sub-tiers.

Pro is a paid professional upgrade for freelancers, creators, service providers, consultants, students/young professionals building a portfolio, and other users who want to present themselves professionally.

## Pricing

Initial Pro price:

```txt
Hellowhen Pro: 14.99 EUR / month
```

Pricing notes:

- Use `EUR 14.99/month` as the planning price.
- Do not expose pricing in the product until subscriptions are explicitly enabled.
- Annual pricing is not decided yet.
- Founding/early-access pricing can be considered later, but should not create permanent product complexity.
- Taxes, invoices, VAT handling, refunds, and cancellation rules must be reviewed before real billing.

## Trial

Recommended future trial:

```txt
14-day Pro trial
```

Trial rules:

- Trial is not first launch scope.
- Identity verification should be required before Pro trial access starts.
- One trial should be allowed per verified identity, not just per email.
- Trial abuse should be reviewable by admin.
- Trial access should expire automatically if the user does not convert.
- Trial should not unlock safety bypasses.

Because identity verification has provider cost and abuse risk, early Pro trials should be manual/admin-approved or limited to selected beta professionals.

## Identity verification requirement

Professional account access requires identity verification.

A paid subscription alone is not enough. Pro access requires:

```txt
identity verified + active/trialing Pro subscription
```

Verification states:

```txt
none
pending_verification
verified
rejected
suspended
```

If verification is rejected or suspended, Pro features must stay locked even if payment exists. Billing/refund handling for this case must be defined before production subscriptions.

## Pro included features

Pro should sell professional presentation, workflow, and visibility.

For detailed future pricing-card and onboarding copy, see `docs/product/pro-feature-catalog-and-plan-copy.md`.

Recommended Pro features:

- identity-verified professional badge
- professional profile section
- professional specialties/service categories
- portfolio/gallery section
- more active Offers
- more media per Need/Offer/Trade where safe
- reusable Need/Offer templates
- proposal/workflow productivity tools
- Pro Trade Packages: one main Need with multiple Offers, or one main Offer with multiple Needs
- analytics such as views, saves, and proposal rate
- custom public profile link
- featured intro card or improved discovery surfaces
- faster support/review where available
- future AI writing/help tools if AI is enabled later

## Pro must not include

Pro must not allow users to:

- bypass moderation
- bypass report handling
- bypass media review
- bypass identity checks
- access private data
- message everyone without limits
- auto-accept or auto-decline proposals
- receive money/payout access without provider/compliance approval
- ignore account restrictions

## Pro Trade Packages

Pro Trade Packages are a future Pro-only workflow feature. They should help professionals package value without changing Free or Plus limits yet.

Future direction:

```txt
Normal trade:
  1 Need <-> 1 Offer

Pro Trade Package:
  1 main Need <-> multiple Offers
  or
  multiple Needs <-> 1 main Offer
```

The first Pro package version should stay simple:

- one main item on one side
- up to a small number of supporting items on the other side
- one owner/applicant pair, not a multi-person group trade
- accepted or declined as one unit
- no partial acceptance of individual package items
- no money/wallet/payout behavior

Recommended first package limit for later implementation:

```txt
Pro package v1:
  one main Need + up to 3 Offers
  or
  one main Offer + up to 3 Needs
```

The exact limit should be implemented later through hidden entitlement constants, not through a Free/Plus limits patch.

For the full product and technical plan, see `docs/product/pro-trade-packages-plan.md`.

## Pro access examples

```txt
Free user:
  professionalStatus = none
  subscriptionTier = free
  subscriptionStatus = none
  Pro access = false

Verified but unpaid professional:
  professionalStatus = verified
  subscriptionTier = free
  subscriptionStatus = none
  Pro access = false

Pro trial:
  professionalStatus = verified
  subscriptionTier = pro
  subscriptionStatus = trialing
  Pro access = true

Active Pro:
  professionalStatus = verified
  subscriptionTier = pro
  subscriptionStatus = active
  Pro access = true

Expired Pro:
  professionalStatus = verified
  subscriptionTier = pro
  subscriptionStatus = expired
  Pro access = false
```

---

# Tier 4 — Business

## Status

Business is a later roadmap item and must be discussed separately before implementation.

It may become either:

```txt
separate accountKind = business
```

or:

```txt
an upgrade from an individual account to a business/brand profile
```

Do not decide that in the Pro patch.

## Future purpose

Business may later support:

- verified brands
- agencies
- shops/restaurants/studios
- organizations
- team members
- business/brand profiles
- business catalogs
- campaign-style Needs
- higher reviewed limits
- business analytics
- future money/provider flows after KYB and approval

## Business verification

Business likely requires KYB/business verification, not only individual identity verification.

Potential requirements:

- legal business name
- registration/company details
- beneficial owner/admin verification
- country support
- payment-provider approval if money is involved
- higher-risk category review

Business is not first launch scope and not part of the first Pro implementation.

---

# Future implementation phases

## Phase 1 — docs and product decision

- Clean this roadmap.
- Confirm Pro price: `EUR 14.99/month`.
- Confirm Pro access rule: identity verified + active/trialing subscription.
- Keep first launch Free only.

## Phase 2 — hidden flags and shared types

Add hidden config only:

```env
SUBSCRIPTIONS_ENABLED=false
PRO_ACCOUNTS_ENABLED=false
PRO_ACCOUNTS_VISIBLE=false
PRO_TRIALS_ENABLED=false
IDENTITY_VERIFICATION_ENABLED=false
PRO_MONTHLY_PRICE_CENTS=1499
PRO_MONTHLY_PRICE_CURRENCY=eur
PRO_TRIAL_DAYS=14

NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED=false
NEXT_PUBLIC_PRO_ACCOUNTS_ENABLED=false
NEXT_PUBLIC_PRO_ACCOUNTS_VISIBLE=false
NEXT_PUBLIC_PRO_TRIALS_ENABLED=false
NEXT_PUBLIC_IDENTITY_VERIFICATION_ENABLED=false

EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=false
EXPO_PUBLIC_PRO_ACCOUNTS_ENABLED=false
EXPO_PUBLIC_PRO_ACCOUNTS_VISIBLE=false
EXPO_PUBLIC_PRO_TRIALS_ENABLED=false
EXPO_PUBLIC_IDENTITY_VERIFICATION_ENABLED=false
```

No visible UI. Price/trial values are planning defaults only until subscription billing is explicitly enabled.

## Phase 3 — backend data foundation

Add backend-only data structures for:

- quick account/pro/subscription gate fields on `User`
- `ProfessionalProfile`
- `SubscriptionState`
- `IdentityVerificationState`
- hidden `/subscriptions/me` API snapshot for future internal/dev use

No public upgrade UI, billing provider, identity-verification provider call, checkout flow, or automatic Pro activation.

Default first-launch flags keep the API surface hidden.

## Phase 4 — admin-only test controls

Allow admin/dev to manually test:

- pending verification
- verified
- rejected
- Pro trialing
- Pro active
- Pro expired

No public upgrade screen yet.


## Phase 4 implementation note — admin-only Pro management foundation

The hidden admin foundation may include an internal admin console and admin API routes for manual testing only:

- search users by email/name/handle/professional metadata
- filter by professional status, subscription tier/status, and identity-verification status
- update professional review status with an admin note
- update subscription tier/status and trial/current-period dates with an admin note
- update identity-verification status with an admin note
- write every change to the admin audit log

This admin foundation must not create public Pro behavior by itself.

It must not add:

- public Pro onboarding
- pricing cards in normal UI
- checkout or billing provider calls
- identity-verification provider calls
- automatic Pro activation from payment
- Business account behavior

Manual admin state is only useful for testing future gates such as:

```txt
professionalStatus = verified
subscriptionTier = pro
subscriptionStatus = trialing or active
=> Pro access true
```

## Phase 5 — hidden web/mobile Pro gate helpers

Add reusable helpers for future UI surfaces without showing Pro publicly:

- shared Pro blocker helpers
- web/mobile Pro gate resolvers
- web/mobile gate components that render nothing by default when Pro is hidden
- price formatting helpers for later pricing cards

This phase must not add public upgrade buttons, checkout, identity-provider calls, billing-provider calls, or visible Pro prompts.

## Phase 6 — provider decisions

Add the provider decision plan in `docs/product/pro-payment-verification-provider-plan.md`.

Before real Pro launch, decide:

- subscription billing provider
- identity verification provider
- cancellation/refund rules
- VAT/invoice handling
- whether Pro launches web/PWA-first, native store billing, or both
- App Store / Google Play implications for native apps
- privacy policy and terms updates
- support/admin handling for failed payments and rejected verification

Initial provider candidates for later review:

```txt
Subscription billing candidate:
  Stripe Billing + Stripe Checkout / Customer Portal

Identity verification candidate:
  Stripe Identity, or manual/admin-approved verification for a private beta

Native subscription decision:
  web/PWA-first is safest until App Store / Google Play policy review is complete
```


## Phase 7 — Pro Trade Packages plan

Document Pro Trade Packages in `docs/product/pro-trade-packages-plan.md`.

This phase is planning only. It should not change Free or Plus limits yet and should not add database/API/UI behavior.

The future feature direction is:

- normal users keep simple one-to-one Trades
- Pro users can later create package-style trades/proposals
- first package version supports one main Need with multiple Offers, or one main Offer with multiple Needs
- packages are accepted or declined as one unit
- no multi-person trade orchestration in v1
- no partial acceptance in v1

---

# Summary

```txt
First launch:
  Free only.

Plus:
  future non-professional individual upgrade, not defined yet.

Pro:
  one professional tier at EUR 14.99/month.
  identity verification required.
  Pro access requires verified identity + active/trialing Pro subscription.

Business:
  later separate account/upgrade decision.
```



## Phase 11 — Pro feature catalog and plan selection copy

Define the future plan-selection copy in `docs/product/pro-feature-catalog-and-plan-copy.md`.

This phase is planning/copy only. It should not add UI, checkout, identity-provider calls, billing-provider calls, native purchase UI, or first-launch visible behavior.

The plan-selection copy should describe:

- Free as the default individual marketplace tier
- Pro as one professional tier at `EUR 14.99/month`
- identity verification as required for Pro access
- active or trialing subscription as required for Pro access
- Business as a later separate account/enterprise decision

The first future pricing UI should show only:

```txt
Free
Pro
Business coming later
```

Do not show Plus in the first plan-selection UI. Plus remains an undecided future non-professional upgrade.


## Phase 12 — Hidden pricing / plan selection UI

Add a hidden web plan-selection route:

```txt
/account/plans
```

The route must remain unavailable unless Pro surfaces are explicitly visible through hidden flags. With default first-launch flags, there must be no Account nav link, no public pricing card, no checkout, no identity-verification prompt, and no visible behavior change.

When the hidden UI is enabled for dev/internal testing, it should show the future plan cards from `docs/product/pro-feature-catalog-and-plan-copy.md`:

```txt
Free
Pro — EUR 14.99/month
Business — coming later
```

The Pro card may explain the identity-verification and active/trialing subscription requirement, but all Pro actions remain provider-disabled until billing and verification providers are connected in a later phase.

Still not included:

- no checkout
- no Stripe Billing
- no Stripe Identity
- no native in-app purchases
- no Account nav entry while Pro is hidden
- no Business onboarding
- no Free/Plus limit changes

### Patch 8 — Hidden Pro Trade Package entitlement constants

Add shared types and entitlement helpers for future Pro Trade Packages.

Defaults stay hidden and disabled:

```txt
tradePackages.enabled = false
requiresProAccess = true
max 1 main Need or Offer
max 3 supporting Needs or Offers
no multi-Need + multi-Offer package yet
no partial acceptance
no group participants
```

Still no visible Pro UI, no checkout, and no first-launch behavior change.


### Patch 9 — Hidden backend proposal package foundation

Add schema/API scaffolding for future Pro proposal packages while keeping the feature disabled by default.

Included foundation:

```txt
TradeProposal.packageKind
TradeProposalPackageItem rows
contract request/response fields
server-side validation helper
Pro-gated package create/update handling
```

Default behavior remains unchanged because `PRO_TRADE_PACKAGES_ENABLED=false` and Pro/subscription flags remain disabled.

### Patch 10 — Hidden Pro Trade Package UI prototype

The first hidden UI prototype is limited to proposal creation surfaces. It gives future Pro testers a way to select multiple supporting Needs or Offers while the public first-launch UI remains unchanged.

Default behavior remains hidden because all Pro, subscription, and package flags default to false.

## Phase 13 — Hidden Pro onboarding skeleton

Add a hidden web-only Pro setup skeleton route:

```txt
/account/pro/setup
```

The route must remain unavailable unless Pro visibility flags are explicitly enabled for internal testing. It must not add a normal Account nav entry and must not appear during first launch.

The skeleton may show the future onboarding sequence:

```txt
review Pro benefits
identity verification required
subscription required
Pro features unlock later
```

All provider actions remain disabled placeholders:

```txt
no checkout
no Stripe Billing session
no Stripe Identity session
no native purchase button
no provider API call
no Pro entitlement activation
```

The hidden `/account/plans` Pro card can link to this skeleton only when Pro visibility and identity-verification flags are enabled for internal testing.
---

## Patch 14 — hidden account entry point

Patch 14 adds the first hidden Account entry point for the plan/prototype plan-selection area.

Scope:

```txt
Web Account:
  Account -> Plan & Pro -> /account/plans

Native Account:
  Account -> Plan & Pro -> hidden plan preview screen
```

Visibility rule:

```txt
Only show the Account entry when PRO_ACCOUNTS_VISIBLE is true through the existing hidden Pro/subscription flags.
```

Default first-launch behavior remains unchanged:

```txt
PRO_ACCOUNTS_VISIBLE=false
NEXT_PUBLIC_PRO_ACCOUNTS_VISIBLE=false
EXPO_PUBLIC_PRO_ACCOUNTS_VISIBLE=false
```

No checkout, identity provider, subscription provider, native in-app purchase, Pro activation, Business onboarding, or public first-launch navigation is added.
