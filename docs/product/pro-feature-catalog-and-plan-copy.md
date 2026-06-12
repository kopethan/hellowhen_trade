# Pro Feature Catalog and Plan Selection Copy

## Status

This document is future planning only.

Do not expose plan selection, Pro pricing cards, trial prompts, upgrade buttons, checkout, identity-verification prompts, or native purchase UI during the first launch unless a later phase explicitly enables them.

Current product decision:

```txt
Free:
  default individual account

Pro:
  EUR 14.99/month
  one professional tier
  identity verification required
  active/trialing subscription required

Business:
  coming later
  separate business/enterprise decision
```

Pro access rule:

```txt
professionalStatus = verified
AND subscriptionTier = pro
AND subscriptionStatus = trialing or active
```

A user who only pays is not Pro if identity verification is missing, rejected, expired, or suspended.

A user who is identity-verified is not Pro if the subscription is inactive, expired, canceled, past due, or missing.

## Membership page purpose

The Membership area should help users understand the difference between Free, Plus, Pro, and separate Business/organization identity before any payment or verification step.

It should not pressure first-launch users or create the impression that the app is incomplete without payment.

Primary route:

```txt
/account/membership
```

The legacy `/account/plans` route should redirect to `/account/membership` so old internal links land on the safe account information page.

## Membership card order

Use personal tier cards plus a separated Business identity card:

```txt
Free / Basic
Plus
Pro
Business / organization identity
```

Why this order:

- Free confirms the current user can still use the core marketplace.
- Pro introduces the one paid professional tier.
- Business is clearly positioned as later, not mixed into Pro.

Show Plus as the personal premium tier, but keep Business visually separated because it is an identity/account type, not simply a personal tier.

## Free plan card copy

### Name

```txt
Free
```

### Tagline

```txt
Start trading needs and offers.
```

### Price

```txt
EUR 0/month
```

### Description

```txt
Use the core Hellowhen Trade marketplace as an individual user.
```

### Included bullets

```txt
Create Needs and Offers
Create normal one-to-one Trades
Send and receive proposals
Use public discussion and private proposal conversations
Basic profile and account settings
Report/support access
```

### Boundary copy

```txt
Professional tools, Pro package proposals, portfolio features, and professional verification are not included.
```

### Button copy

When the user is already Free:

```txt
Current plan
```

When shown to a logged-out or future comparison user:

```txt
Get started
```

No payment action should be attached to the Free card.

## Pro plan card copy

### Name

```txt
Pro
```

### Badge

```txt
For professionals
```

### Price

```txt
EUR 14.99/month
```

### Trial note

```txt
14-day trial planned
```

Do not promise the trial in public UI until provider, verification, abuse, refund, and cancellation rules are finalized.

If a future UI is still provider-disabled, use:

```txt
Trial planned for a future Pro beta.
```

### Tagline

```txt
Show more value, build trust, and work faster.
```

### Description

```txt
For freelancers, creators, service providers, consultants, and professionals who want stronger profile, proposal, and discovery tools.
```

### Requirement copy

```txt
Requires identity verification and an active or trialing Pro subscription.
```

### Included bullets for first Pro marketing card

Keep the first visible Pro card focused and not too long:

```txt
Verified Professional badge
Professional profile section
Pro Trade Packages
Portfolio/gallery tools later
Reusable proposal and offer templates later
Basic analytics later
Priority visibility experiments later
```

### Expanded benefit copy

Use this in an accordion, detail page, or later onboarding step.

#### Verified Professional badge

```txt
Show that your professional profile is identity-verified and connected to an active Pro subscription.
```

Safety wording:

```txt
Verification does not mean Hellowhen guarantees the quality, safety, or outcome of any trade.
```

#### Professional profile section

```txt
Present your professional title, specialties, languages, location/remote availability, and service categories.
```

#### Pro Trade Packages

```txt
Create richer proposal packages such as one main Need with multiple Offers, or one main Offer with multiple Needs.
```

Boundary:

```txt
Packages are accepted or declined as one unit. Group trades and partial acceptance are not part of the first package version.
```

#### Portfolio/gallery tools later

```txt
Show selected examples of your work directly on your profile or offers.
```

#### Templates later

```txt
Reuse proposal, Need, and Offer templates so you can respond and publish faster.
```

#### Analytics later

```txt
Understand basic performance such as profile views, offer views, and proposal activity.
```

#### Priority visibility experiments later

```txt
Test limited visibility boosts without hiding Free users or making sponsored placement look organic.
```

### Button copy states

Default first-launch hidden state:

```txt
Coming later
```

Future private beta state when Pro UI is visible but providers are not connected:

```txt
Join Pro beta
```

Future provider-connected state:

```txt
Start Pro setup
```

If identity verification is pending:

```txt
Continue verification
```

If identity is verified but billing is missing:

```txt
Start subscription
```

If subscription is active:

```txt
Manage Pro
```

If subscription is expired/canceled:

```txt
Reactivate Pro
```

## Business plan card copy

### Name

```txt
Business
```

### Badge

```txt
Coming later
```

### Price

```txt
Custom / later
```

Do not set Business pricing yet.

### Tagline

```txt
For verified brands, teams, and organizations.
```

### Description

```txt
Business accounts are planned for brands, agencies, shops, studios, and teams that need organization-level verification, campaigns, libraries, and team controls.
```

### Possible future bullets

```txt
Business verification / KYB
Team members and roles
Brand profile and library items
Campaign-style Needs and Offers
Sponsored placements later
Business analytics later
Budget controls later
```

### Boundary copy

```txt
Business is not part of the first Pro launch and will be designed separately.
```

### Button copy

```txt
Coming later
```

## Pro feature catalog

The catalog below defines the future Pro benefit groups. It does not implement them.

### Trust and identity

```txt
Verified Professional badge
Professional status label
Identity-verification status shown safely to the user
Admin review status for rejected/suspended verification
```

Do not use words that imply Hellowhen guarantees work quality.

Avoid:

```txt
Certified expert
Guaranteed professional
Hellowhen-approved expert
```

Prefer:

```txt
Verified Professional
Identity verified
Professional profile
```

### Profile and presentation

```txt
Professional title
Specialties
Service categories
Professional bio/summary
Languages
Location / remote availability
Custom profile link
Portfolio/gallery later
Featured intro card later
```

### Trade workflow

```txt
Pro Trade Packages
Reusable proposal templates later
Reusable Offer templates later
Reusable Need templates later
Saved package drafts later
```

### Discovery and visibility

```txt
Limited priority visibility experiments later
Featured profile or offer slots later
Transparent sponsored placement boundaries
No guarantee of leads or acceptance
No hiding Free users from core discovery
```

### Analytics

```txt
Profile views later
Offer views later
Trade/package views later
Proposal sent count later
Proposal acceptance rate later
Save/bookmark count later
```

Analytics must avoid exposing private proposal content or private user behavior beyond safe aggregate counts.

### Support

```txt
Faster support/review queue where available
Clearer professional account status support
No moderation bypass
```

## What Pro must never unlock

Pro must not unlock:

```txt
moderation bypass
report bypass
media-review bypass
access to private proposals outside the participant pair
access to private messages outside the participant pair
ability to message everyone without safe context
ability to auto-accept or auto-decline proposals
ability to avoid account restrictions
money, wallet, payout, or payment access without later provider/compliance approval
business/KYB privileges
```

## Plan selection UI safety rules

The future plan selection UI must follow these rules:

```txt
Hidden by default.
No first-launch nav link.
No checkout until billing provider is connected.
No identity prompt until verification provider/manual flow is ready.
No native purchase buttons until App Store / Google Play policy review is complete.
No pricing promises if taxes, invoices, refund, and cancellation rules are undecided.
No Business CTA that implies Business is available.
```

## Recommended future onboarding sequence

When Pro is eventually enabled, use this order:

```txt
1. User reads plan card.
2. User chooses Pro.
3. App explains identity verification requirement.
4. User completes identity verification or manual review.
5. User starts trial/subscription.
6. Backend confirms both states.
7. Pro features unlock.
```

Do not unlock Pro after only step 4 or only step 5.

## Copy snippets for future onboarding

### Verification intro

```txt
Professional profiles require identity verification before Pro tools can be used.
```

### Subscription intro

```txt
After verification, start your Pro subscription to unlock professional tools.
```

### Pending verification

```txt
Your verification is being reviewed. Pro tools will unlock only after verification is approved and your Pro subscription is active or trialing.
```

### Rejected verification

```txt
We could not approve your professional verification. Pro tools are unavailable until this is resolved.
```

### Expired subscription

```txt
Your Pro subscription is no longer active. Your verified identity status may remain on your account, but Pro tools are locked until you reactivate.
```

## Future implementation sequence

Recommended next phases:

```txt
Patch 12:
  Hidden pricing / plan selection UI.

Patch 13:
  Hidden Pro onboarding skeleton.

Patch 14:
  Hidden Account entry point.

Later:
  Provider integration after billing and identity decisions are finalized.
```

## Summary

```txt
Free:
  Core individual marketplace access.

Pro:
  EUR 14.99/month.
  One professional tier.
  Identity verification required.
  Active/trialing subscription required.
  Professional presentation, Pro packages, templates, analytics, and visibility tools.

Business:
  Coming later.
  Separate organization/enterprise design.
```

## Membership implementation note

The tier explanation UI lives at:

```txt
/account/membership
```

The Membership page can stay visible from Account as an information page, but Pro/Business actions must remain disabled unless their existing visibility and provider flags are intentionally enabled.

The Membership page can show Free/Plus/Pro and a separated Business identity explanation, but every Pro/Business action must remain non-functional until provider phases are implemented.

Allowed hidden behavior:

```txt
Show the Free / Plus / Pro personal tier cards and separated Business identity card
Show EUR 14.99/month planning price for Pro
Show identity + subscription requirements
Show Business as coming later
Show a hidden-preview/provider-disabled notice
```

Forbidden in this phase:

```txt
checkout
identity verification launch
native purchase buttons
checkout/provider CTA while Pro is hidden
public upgrade prompts
Business onboarding
```

## Hidden Pro onboarding skeleton copy

Future route candidate:

```txt
/account/pro/setup
```

The route should stay unavailable unless Pro surfaces are explicitly enabled for internal testing. It must not be linked from Account during first launch.

The skeleton flow should explain four steps without starting provider actions:

```txt
1. Review the Pro upgrade
2. Verify identity
3. Start the Pro subscription
4. Unlock Pro features later
```

### Page intro

```txt
Professional upgrade preview
This hidden flow explains the future Pro onboarding path without starting verification, checkout, or native purchases.
```

### Requirement summary

```txt
Pro requires verification + subscription
Pro access will only be available when identity is verified and the subscription status is active or trialing.
```

### Step copy

#### Review

```txt
Review the Pro upgrade
Pro is planned at EUR 14.99/month with a 14-day trial model. It is for verified professionals who need stronger profile, proposal, and package tools.
```

#### Identity

```txt
Verify identity
Identity verification is required for Pro, but the provider is not connected in this hidden prototype.
```

#### Billing

```txt
Start the Pro subscription
Subscription billing is not connected yet. This step stays as a placeholder until the billing provider is selected and implemented.
```

#### Access

```txt
Unlock Pro features later
After verified identity and an active or trialing subscription, Pro can unlock features like Pro Trade Packages, professional profile sections, and future portfolio tools.
```

### Disabled provider action copy

```txt
Provider steps are intentionally disabled
No payment provider, identity provider, checkout session, native purchase, or Pro entitlement activation is connected in this prototype.
```

Allowed in this hidden skeleton:

```txt
show Pro setup steps
show planned price and trial duration
show identity + subscription requirement
show disabled provider buttons
show sign-in reminder
link back to /account/membership
```

Forbidden in this hidden skeleton:

```txt
real checkout
Stripe Billing session creation
Stripe Identity session creation
native in-app purchase buttons
Pro entitlement activation
admin status mutation
public account navigation entry
Business onboarding
```
---

## Patch 14 — hidden account entry point

Patch 14 originally added the first hidden Account entry point for the plan/prototype tier area. TIERS10 supersedes the old route by redirecting it to Membership.

Scope:

```txt
Web Account:
  Account -> Membership -> /account/membership

Native Account:
  Account -> Membership -> hidden tier preview screen
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
