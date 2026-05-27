# Pro Trade Packages Plan

## Status

This document is future planning only.

Do not expose Pro Trade Packages during the first launch. Hidden backend/schema scaffolding may exist, but do not add public package UI, billing, checkout, identity-verification provider calls, or Pro onboarding until a later phase explicitly enables them.

This plan does **not** change Free or Plus limits yet.

Current Pro decision:

```txt
Hellowhen Pro price: EUR 14.99/month
Trial target: 14 days
Pro access rule: identity verified + active/trialing Pro subscription
Business account: later separate decision
```

## Product idea

Normal Hellowhen trades are simple one-to-one exchanges:

```txt
1 Need <-> 1 Offer
```

Professionals may need to package more value. A Pro Trade Package lets a Pro user create or propose a richer exchange:

```txt
1 main Need <-> multiple Offers
```

or:

```txt
multiple Needs <-> 1 main Offer
```

This should help professionals show what they can deliver without giving them unsafe privileges or forcing Free/Plus limit changes now.

## Why this makes sense for Pro

Professionals often provide service bundles rather than one tiny item.

Examples:

```txt
I need:
  Landing page copy

I offer as a package:
  Product photo editing
  Logo feedback
  Social media post design
```

```txt
I offer:
  Full landing page review

I need as a package:
  French correction
  Portfolio photos
  Product feedback
```

This gives Pro users a stronger way to describe value while keeping normal trades simple.

## First version boundary

The first package version should be intentionally small:

```txt
Pro package v1:
  one main Need + up to 3 Offers
  or
  one main Offer + up to 3 Needs
```

Do not start with unlimited packages.

Do not start with:

```txt
multiple Needs <-> multiple Offers
```

That can be reviewed later after the simple package model works.

## Access rule

Pro Trade Packages should require Pro access:

```txt
professionalStatus = verified
subscriptionTier = pro
subscriptionStatus = trialing or active
```

A user should not get package access from payment alone. Identity verification remains required.

A user should not get package access from identity verification alone. Active or trialing Pro subscription remains required.

## UX model

### Create Trade Package

A future Pro package create flow can look like this:

```txt
I need
Landing page copy

I offer as a package
1. Product photo editing
2. Logo feedback
3. Social media post design
```

or:

```txt
I offer
Landing page review

I need as a package
1. French correction
2. Product feedback
3. Portfolio photo help
```

The UI should make the main item clear and then list the supporting package items below it.

### Proposal package

A Pro user may send a package proposal:

```txt
Sara sent a Pro package

Sara offers:
- Landing page review
- SEO feedback
- CTA copy suggestions

Sara needs:
- Product photos

Message:
"I can do the review by Friday and include SEO notes too."
```

The trade owner accepts or declines the whole package.

## Acceptance model

Use a whole-package acceptance model:

```txt
A Pro Trade Package is accepted or declined as one unit.
```

Do not implement partial acceptance in the first version.

Avoid:

```txt
Accept Offer 1 but reject Offer 2
Accept Need 1 but reject Need 2
Separate chat per package item
Separate completion state per package item
Separate dispute state per package item
```

Partial package negotiation can be considered later, but it adds complexity to permissions, status, chat, completion, disputes, and moderation.


## Shared hidden entitlements

Patch 8 adds shared package types and entitlement helpers only. These helpers are not connected to database rows, API routes, web UI, native UI, checkout, or identity-provider calls yet.

Default package entitlement state:

```txt
enabled: false
requiresProAccess: true
maxMainNeeds: 1
maxMainOffers: 1
maxSupportingNeeds: 3
maxSupportingOffers: 3
allowMultiNeedMultiOffer: false
allowPartialAcceptance: false
allowGroupParticipants: false
```

This means the shared code already expresses the future product boundary, but the product remains hidden and unusable until a later patch explicitly enables the backend and UI.

Shared package kinds:

```txt
standard
main_need_multi_offer
main_offer_multi_need
```

The `standard` kind represents the current normal trade shape and should not be treated as a Pro package.

Package access blockers should include:

```txt
trade_packages_disabled
pro_access_required
```

Package validation blockers should include missing main/supporting items, too many supporting items, and unsupported multi-Need/multi-Offer combinations.

## Multi-person boundary

Pro Trade Packages should not become group trades in v1.

Allowed in v1 planning:

```txt
One creator/applicant pair
One private proposal thread
One accepted package
One package-level status
```

Avoid in v1:

```txt
Many different users contributing to one package
Multiple accepted applicants in one package
Group settlement
Group proposal chat
Per-person package acceptance
```

Multi-person trades should be a separate future product design because they affect permissions, safety, moderation, cancellation, and dispute handling.

## Privacy and safety

Packages must follow the same safety rules as normal trades.

A package must not unlock:

- access to private proposals outside the participant pair
- private messages outside the participant pair
- moderation bypass
- report bypass
- media-review bypass
- account-restriction bypass
- automatic acceptance
- automatic admin decisions
- money/payout behavior without later provider/compliance approval

If a Pro user is restricted or suspended, package creation and proposal package actions must be blocked like normal trade actions.

## Display rules

Package cards and proposal summaries should be clear and non-misleading.

Recommended labels:

```txt
Pro package
Package offer
Package need
```

Avoid labels that imply Hellowhen guarantees the professional's work, such as:

```txt
Certified expert package
Guaranteed professional package
Hellowhen-approved expert
```

A verified professional badge means identity and subscription status are valid. It does not mean Hellowhen guarantees work quality.

## Data model direction for later

Do not implement this in this docs patch, but a later backend foundation can use an ordered package-item model.

Possible future model:

```txt
TradePackage
  id
  tradeId or proposalId
  ownerId
  direction
  status
  createdAt
  updatedAt

TradePackageItem
  id
  packageId
  side: need | offer
  itemType: need | offer
  itemId
  role: main | supporting
  sortOrder
```

For proposal packages, the package may belong to the proposal instead of the public trade until accepted.

The exact model should be audited against the current Trade, Need, Offer, Proposal, and ProposalMessage schema before implementation.

## API direction for later

Future package APIs should stay behind Pro/subscription feature gates.

Possible future endpoints:

```txt
POST /trades/packages
PATCH /trades/packages/:packageId
POST /proposals/:proposalId/package
PATCH /proposals/:proposalId/package
```

Do not expose these until:

- Pro gates exist in backend route guards
- identity/subscription entitlement state is reliable
- private proposal permissions are verified
- admin/moderation behavior is defined

## Admin/moderation direction

Admin should be able to inspect a package as one unit.

Admin should later see:

- package owner
- main item
- supporting items
- linked trade/proposal
- private/public visibility context
- report/support links
- package status
- audit history

Admin should be able to hide/restrict a package through existing content/user moderation patterns, but the exact moderation model should be designed with the schema patch.

## What this patch does not decide

This plan does not decide:

- Free or Plus active limits
- exact Pro package limit beyond the recommended v1 maximum of 3 supporting items
- package database schema
- package route names
- package UI implementation
- payment provider
- identity provider
- native purchase flow
- Business/KYB behavior
- money/wallet/payout behavior

## Future implementation phases

Recommended sequence:

```txt
Patch 7:
  Document Pro Trade Packages.

Patch 8:
  Add hidden shared package entitlement constants.

Patch 9:
  Audit Trade/Proposal schema and plan package data model.

Patch 10:
  Add backend package schema/API foundation behind Pro gates.

Patch 11:
  Add hidden web package creation/proposal prototype.

Patch 12:
  Add hidden mobile package creation/proposal prototype.
```

Each phase should keep first-launch behavior unchanged unless a later launch decision explicitly enables Pro.

## Summary

```txt
Normal trades stay simple:
  1 Need <-> 1 Offer

Future Pro Trade Packages allow:
  1 main Need + multiple Offers
  or
  1 main Offer + multiple Needs

Pro packages require:
  identity verified + active/trialing Pro subscription

First package version:
  accepted/declined as one unit
  one participant pair
  no partial acceptance
  no group trade behavior
  no money behavior
```

## Backend foundation patch

Patch 9 adds only hidden backend/schema support for proposal packages.

Included foundation:

```txt
TradeProposal.packageKind
TradeProposalPackageItem rows
contract request fields for package drafts
contract response fields for package items
server-side package validation helpers
Pro-gated create/update proposal package handling
```

Default behavior remains unchanged because:

```txt
PRO_TRADE_PACKAGES_ENABLED=false
subscriptions/pro flags remain disabled
no package UI exists
normal one Need <-> one Offer proposals keep working
```

The first backend-supported package flows are intentionally limited to open proposal flows:

```txt
Open Need trade:
  the existing trade Need is the main Need
  a verified Pro applicant can propose multiple supporting Offers

Open Offer trade:
  the existing trade Offer is the main Offer
  a verified Pro applicant can propose multiple supporting Needs
```

The package is still accepted or declined as one unit. The accepted trade keeps the existing first selected Need/Offer fields for compatibility, while the accepted proposal keeps the full package item list for future detail UI.

## Patch 10 — hidden UI prototype direction

The hidden UI prototype should stay behind public client flags and should not appear in the first launch.

Client flags:

```env
NEXT_PUBLIC_PRO_TRADE_PACKAGES_ENABLED=false
NEXT_PUBLIC_PRO_TRADE_PACKAGES_VISIBLE=false
EXPO_PUBLIC_PRO_TRADE_PACKAGES_ENABLED=false
EXPO_PUBLIC_PRO_TRADE_PACKAGES_VISIBLE=false
```

Prototype behavior:

- Web proposal composer can show a hidden Pro package selector when package flags are manually enabled.
- Native private proposal composer can show the same hidden package selector when package flags are manually enabled.
- Open Need trades can test one main Need with multiple supporting Offers.
- Open Offer trades can test one main Offer with multiple supporting Needs.
- The package is still submitted as one proposal and must be accepted or declined as one unit.
- Backend Pro access, subscription, and package guards remain the source of truth.

Still not part of the first launch:

- public upgrade UI
- checkout
- identity-provider integration
- free/plus limit changes
- package create-trade flow
- package edit flow
- partial acceptance
- group or multi-person package trades
