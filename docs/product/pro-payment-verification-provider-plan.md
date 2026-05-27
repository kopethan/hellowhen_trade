# Pro Payment and Identity Verification Provider Plan

## Status

This document is future planning only.

The first beta launch remains **Free only**. Do not add checkout, identity-verification prompts, Pro onboarding, native in-app purchases, pricing cards, payment provider SDKs, or verification provider SDKs until a later phase explicitly enables them.

Current Pro decision:

```txt
Hellowhen Pro price: EUR 14.99/month
Trial target: 14 days
Pro access rule: identity verified + active/trialing Pro subscription
Business account: later separate decision
```

## Core principle

Pro is not a free account type.

Pro should be a paid professional upgrade that requires identity verification. Payment and identity verification must remain separate safety layers:

```txt
Identity verification answers:
  Is this person verified enough for professional trust surfaces?

Subscription billing answers:
  Is this person currently paying or trialing for Pro tools?

Pro access answers:
  Are both conditions true?
```

A paid subscription alone must not unlock Pro if identity verification is missing, rejected, expired, or suspended.

A verified identity alone must not unlock Pro if the subscription is not active or trialing.

## Recommended launch path

Use a staged path:

```txt
Stage 1:
  Hidden foundation only.
  No provider integration.
  Admin can manually test states.

Stage 2:
  Web-only private Pro beta.
  Stripe Billing candidate for subscriptions.
  Stripe Identity candidate for identity verification.
  Admin approval/manual review remains available.

Stage 3:
  Native entitlement consumption only, if store-review safe.
  Native apps can read Pro status but should not expose external checkout links unless policy/legal review allows it.

Stage 4:
  Native purchase implementation decision.
  Use Apple/Google in-app purchases if required for digital Pro features in native apps, or keep native as consumption-only where allowed.

Stage 5:
  Business/KYB provider decision later.
  Do not mix Business into the first Pro provider decision.
```

## Provider candidates

### Subscription billing candidate

Preferred first candidate:

```txt
Stripe Billing + Stripe Checkout or Customer Portal
```

Why it fits the first Pro launch:

- good web subscription fit
- supports recurring subscription lifecycle
- can support trial configuration
- can send webhook events to update internal entitlements
- avoids building custom card storage or billing UI
- can be tested in sandbox/test mode first

What must be decided before production:

- product and price IDs
- monthly price: EUR 14.99
- annual price: undecided
- trial behavior
- payment method required before trial or not
- cancellation and access-end timing
- refund policy
- invoice and tax/VAT handling
- failed-payment grace period
- dunning emails and past-due behavior
- whether Pro billing is web-only, native IAP, or both

### Identity verification candidate

Preferred first candidate:

```txt
Stripe Identity
```

Why it fits the first Pro launch:

- hosted verification flow candidate
- document/selfie verification candidate
- can return provider status to the backend
- keeps raw identity-document handling out of Hellowhen where possible
- can share vendor/account relationship with Stripe Billing if Stripe is selected for subscriptions

Alternatives to compare later:

```txt
Persona
Veriff
Yoti
Onfido / Entrust
Airwallex KYC/KYB later for money/business flows
Manual admin review for very early private beta
```

The first paid Pro beta can use manual/admin-approved verification if provider cost, legal review, or implementation effort is not ready.

## Native app billing caution

Hellowhen Pro features are expected to include digital app benefits such as professional profile tools, badges, portfolio/gallery, analytics, templates, and discovery tools.

Because those benefits can be used inside native apps, native billing rules may require special handling.

Safe planning rule:

```txt
Do not add native Pro purchase buttons or external checkout links until App Store / Google Play policy review is complete.
```

Recommended options:

### Option A — Web-first Pro, native consumption-only

Users subscribe on the web. Native apps only read entitlement status and unlock Pro features if policy review confirms this is acceptable.

Native apps must avoid:

- external checkout links
- copy like "go to our website to subscribe"
- pricing cards that cannot complete through the store
- hidden payment workarounds

### Option B — Store-native subscriptions

Use:

```txt
Apple StoreKit / App Store in-app purchases
Google Play Billing subscriptions
```

Backend still remains the entitlement source of truth after validating store receipts/server notifications.

This adds more complexity but may be safer for native digital Pro features.

### Option C — Web/PWA Pro only at first

Keep Pro upgrade available only on web/PWA and do not expose Pro purchase surfaces in native apps until store billing is implemented.

This is the safest early path if there is uncertainty.

## Recommended first production approach

For the first real Pro experiment, prefer:

```txt
Web/PWA Pro beta only
Stripe Billing test mode first
Stripe Identity or manual verification first
Native apps remain Free or entitlement-consumption only
No native purchase UI
No Business accounts
```

This reduces App Store / Google Play risk while validating whether users are willing to pay EUR 14.99/month.

## Trial policy

Target trial:

```txt
14 days
```

Recommended rules:

- trial is not first launch scope
- trial starts only after identity verification is approved
- one trial per verified identity
- one trial per payment method where practical
- one trial per user account
- admin can revoke trial access for abuse
- trial does not bypass moderation or safety limits
- trial converts to `active` only after provider confirms successful payment
- trial moves to `expired` or `canceled` when it ends without conversion

Early beta rule:

```txt
Use manual/admin-approved Pro trials first.
```

Reason:

- identity verification may have provider cost
- trial abuse is easier before mature fraud controls
- marketplace value is not proven yet
- admin review gives better learning during the first Pro beta

## Entitlement model

Hellowhen should keep its own entitlement records and not rely on client state.

Source of truth:

```txt
User quick fields:
  professionalStatus
  subscriptionTier
  subscriptionStatus

ProfessionalProfile:
  public/professional profile metadata

SubscriptionState:
  provider subscription state and dates

IdentityVerificationState:
  provider verification state and dates
```

Provider state updates should be written by backend webhook handlers or admin actions, not by client requests.

The Pro gate remains:

```txt
professionalStatus = verified
subscriptionTier = pro
subscriptionStatus = trialing or active
```

## Webhook requirements

Future billing provider webhooks should handle at least:

- checkout completed
- subscription created
- subscription trial started
- subscription trial ending soon, optional
- subscription updated
- subscription canceled
- invoice paid
- invoice payment failed
- subscription past due
- refund issued
- dispute/chargeback opened

Future identity provider webhooks should handle at least:

- verification session created
- verification processing
- verification approved
- verification requires input
- verification rejected
- verification expired
- verification canceled

Webhook implementation rules:

- verify provider webhook signatures
- use idempotency keys or event IDs
- store raw event metadata only when necessary
- do not store raw ID document images in Hellowhen
- write audit logs for entitlement changes
- keep admin override/review path
- never let the client directly mark itself verified or paid

## Cancellation and access rules

Recommended subscription behavior:

```txt
Canceled but paid-through current period:
  subscriptionStatus = active until period end
  cancelAtPeriodEnd = true
  Pro access remains true until period end

Payment failed:
  subscriptionStatus = past_due
  Pro access false, or short grace period if explicitly configured later

Expired:
  subscriptionStatus = expired
  Pro access false

Refunded / chargeback:
  subscriptionStatus reviewed by admin or set to canceled/expired depending on policy
  Pro access may be removed immediately
```

The exact grace-period policy should be decided before production billing.

## Verification expiry and re-check rules

Identity verification should not be treated as permanently unlimited without a policy.

Future policy options:

```txt
Option A:
  verification does not expire unless provider/admin changes status

Option B:
  verification expires after a defined period, such as 1-3 years

Option C:
  verification remains valid, but re-check is required for higher-risk features
```

For early Pro, use:

```txt
verification expiresAt optional
admin can manually suspend professional status
provider can update verification state
```

## Privacy and data handling

Hellowhen should store minimal verification data.

Store:

- provider name
- provider account/session/customer IDs
- verification status
- timestamps
- country if needed for eligibility
- last error/rejection category if provider allows it safely
- admin notes

Avoid storing:

- raw identity documents
- selfie/liveness images
- unnecessary full legal ID data
- provider secrets in logs
- sensitive verification payloads in normal admin pages

Before production, update:

- Privacy Policy
- Terms
- Pro terms / subscription terms
- refund/cancellation policy
- data retention policy
- provider DPA / data processing review
- support scripts for verification/payment issues

## Tax, VAT, invoices, and accounting

Before production billing, decide:

- whether Stripe Tax or another tax tool is needed
- VAT treatment for France/EU and international users
- invoice numbering and legal invoice requirements
- whether prices are tax-inclusive or tax-exclusive
- refund credit-note handling
- accounting export workflow
- SASU accountant review

Do not launch real Pro billing until this is reviewed.

## Admin requirements before provider launch

Before provider integration goes live, admin should be able to:

- search Pro candidates
- view professional status
- view identity verification status
- view subscription status
- view provider IDs without exposing secrets
- manually suspend professional status
- manually remove Pro access
- add admin notes
- see audit log entries
- reconcile provider events
- handle support tickets for billing/verification problems

Admin should not be able to fake provider payment events in production except through explicit supervised override actions with audit notes.

## Product copy rules

Use:

```txt
Hellowhen Pro
EUR 14.99/month
Identity verification required
14-day trial, if eligible
Cancel anytime, subject to billing terms
```

Avoid:

```txt
Verified because paid
Guaranteed professional
Approved by Hellowhen forever
Money/payout access included
Business verified
```

Use trust-safe copy:

```txt
Identity verified for professional features.
Verification improves trust but does not remove marketplace safety checks.
```

## Business boundary

Business is not part of the first Pro provider decision.

Business may later need:

- KYB provider
- business documents
- owner/admin identity verification
- team roles
- higher limits
- brand profile review
- business invoices and VAT details
- money-provider approval if payments are involved

Do not overload Pro with Business behavior.

## Decision checklist before coding providers

Answer these before real provider integration:

```txt
1. Is Pro sold only on web/PWA first?
2. Will native apps be consumption-only or use store subscriptions?
3. Is Stripe Billing the first subscription provider?
4. Is Stripe Identity the first identity provider?
5. Will trials require payment method upfront?
6. Who pays identity-verification cost during trial?
7. What is the refund and cancellation policy?
8. What happens if payment succeeds but identity fails?
9. What happens if identity succeeds but payment fails?
10. Is there a grace period for failed payments?
11. Does identity verification expire?
12. What tax/VAT/invoice setup is required for France/EU?
13. What support workflow handles rejected verification?
14. What admin override actions are allowed?
15. What store-review notes are needed for Apple/Google?
```

## Future implementation order

Recommended provider implementation order:

```txt
1. Provider strategy doc, this file.
2. Provider env flags only.
3. Stripe Billing test-mode adapter.
4. Stripe Identity test-mode adapter.
5. Web-only admin/dev checkout test.
6. Web/PWA private Pro beta.
7. Entitlement reconciliation and support flows.
8. Store billing decision for native apps.
9. Public Pro launch.
10. Business/KYB later.
```

## Non-goals for the next patch

Do not add yet:

- Stripe SDK
- Apple StoreKit
- Google Play Billing
- identity provider SDK
- checkout routes
- webhook routes
- pricing UI
- upgrade buttons
- public Pro onboarding
- mobile external payment links
- Business onboarding
- wallet, payout, or money-trade access
