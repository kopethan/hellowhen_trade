# Future Subscription Roadmap

## Status

This document is for future planning only.

The first beta launch is Free only.

Do not expose Plus, Pro, or Business subscription UI in the first beta unless a future phase explicitly enables it.

## Subscription Principle

The core marketplace should remain easy to join.

Subscriptions should not block basic marketplace liquidity.

Do not charge users just to:

- create a basic Need
- create a basic Offer
- create a basic one-to-one Trade
- send a basic proposal
- participate in normal service/goods exchanges

Paid tiers should unlock:

- trust features
- advanced trade features
- money features when legally/payment-provider ready
- professional tools
- business/brand tools
- better visibility and workflow
- support enhancements

## Important Safety Rule

Paid users must not bypass safety.

A paid subscription must not automatically bypass:

- identity checks
- payment-provider checks
- KYC/KYB
- media review
- reports
- disputes
- anti-spam limits
- fraud/risk controls
- admin restrictions

Verification and trust checks are safety layers, not just paid benefits.

---

# Tier 1 — Free

## Purpose

Free is the core marketplace tier.

It should allow users to understand and use Hellowhen Trade without payment.

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
- Hidden anti-spam limits

## Not Included

- In-platform money trades
- Wallet
- Payouts
- Multi-person trades
- Multi-Need / multi-Offer trades
- Business/brand tools
- Platform-level business goods/services
- Paid visibility tools

## Trade Scope

Free users can create one-to-one Trades:

```txt
Person A ↔ Person B



Create these docs manually.

## 1. `docs/product/beta-launch-free-tier.md`

```md
# First Beta Launch — Free Tier

## Status

This document defines the confirmed first beta launch model for Hellowhen Trade.

The first beta is **Free only**.

Paid tiers such as Plus, Pro, and Business are future roadmap ideas only and must not be exposed in the first beta product UI unless explicitly enabled later.

## First Beta Product Direction

The first beta focuses on:

- Needs
- Offers
- Service exchanges
- Goods exchanges
- Other non-money exchanges
- One-to-one Trades between two people

The first beta does **not** include:

- Wallets for normal users
- Payouts for normal users
- In-platform money trades
- Platform-managed cash flow
- Credits
- Cash/off-platform payment handling by Hellowhen
- Business/brand marketplace tools
- Multi-person trades

## Free Beta User Experience

Users should be able to:

- Create Needs
- Create Offers
- Create Trades
- Send proposals
- Accept or decline proposals
- View active public Trades
- Manage their own Needs and Offers
- Manage their profile
- Access settings and support

The app should feel open and easy to join.

Do not describe the product as “unlimited” in user-facing marketing copy, even if the beta is generous. Use wording like:

> Create Needs, Offers, and Trades for service and goods exchanges during beta.

## Trade Model

For first beta:

- One Trade is between Person A and Person B.
- A Trade can include one Need side and one Offer side.
- Needs and Offers are private inventory before they are attached to a public Trade.
- Once a Need or Offer is attached to an active public Trade, the attached content becomes part of that public Trade.
- Public active Trade detail pages may show the Need/Offer content and images attached to that Trade.

## Money-Off Rule

The first beta is money-off.

Hellowhen should not process, protect, hold, guarantee, or manage money during first beta.

Recommended user-facing wording:

> Hellowhen does not process payments, payouts, wallets, or cash trades during beta.

Avoid encouraging off-platform payment inside the product.

If users independently arrange something outside Hellowhen, that is outside the platform’s control and should not be presented as a supported Hellowhen feature.

## Hidden Safety Limits

Even though the first beta should feel generous, the backend should protect the app from spam and abuse.

Internal protections may include:

- Need creation rate limits
- Offer creation rate limits
- Trade creation rate limits
- Proposal/message rate limits
- Media upload limits
- Duplicate-content checks
- Abuse/report handling
- Temporary user restrictions
- Admin moderation tools
- Account suspension for abuse

These limits should not be marketed as normal product limits unless needed.

## Verification in First Beta

Identity verification is not required by default for normal first-beta service/goods trades.

However, Hellowhen may request verification or restrict activity if:

- a user triggers risk signals
- a user posts spam
- a user is reported repeatedly
- a user attempts suspicious activity
- a user requests access to future higher-risk features
- a user later wants money, professional, or business features

Verification is a trust and safety layer, not only a paid-tier feature.

## First Beta UI Rules

First beta UI should not expose:

- wallet
- payout
- Airwallex
- Stripe
- money provider controls
- business account upgrades
- brand tools
- paid subscription prompts
- credits language
- money trade creation

A small `BETA` badge is acceptable.

Avoid long repeated beta explanation cards in core screens.
```

---

## 2. `docs/product/future-subscription-roadmap.md`

````md
# Future Subscription Roadmap

## Status

This document is for future planning only.

The first beta launch is Free only.

Do not expose Plus, Pro, or Business subscription UI in the first beta unless a future phase explicitly enables it.

## Subscription Principle

The core marketplace should remain easy to join.

Subscriptions should not block basic marketplace liquidity.

Do not charge users just to:

- create a basic Need
- create a basic Offer
- create a basic one-to-one Trade
- send a basic proposal
- participate in normal service/goods exchanges

Paid tiers should unlock:

- trust features
- advanced trade features
- money features when legally/payment-provider ready
- professional tools
- business/brand tools
- better visibility and workflow
- support enhancements

## Important Safety Rule

Paid users must not bypass safety.

A paid subscription must not automatically bypass:

- identity checks
- payment-provider checks
- KYC/KYB
- media review
- reports
- disputes
- anti-spam limits
- fraud/risk controls
- admin restrictions

Verification and trust checks are safety layers, not just paid benefits.

---

# Tier 1 — Free

## Purpose

Free is the core marketplace tier.

It should allow users to understand and use Hellowhen Trade without payment.

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
- Hidden anti-spam limits

## Not Included

- In-platform money trades
- Wallet
- Payouts
- Multi-person trades
- Multi-Need / multi-Offer trades
- Business/brand tools
- Platform-level business goods/services
- Paid visibility tools

## Trade Scope

Free users can create one-to-one Trades:

```txt
Person A ↔ Person B
```

---

# Tier 2 — Plus

## Purpose

Plus is for verified individual users who want more trust, support, and future money-related access.

## Verification

Identity verification is required for Plus features that involve trust, higher limits, or future money access.

Paying for Plus does not automatically guarantee approval for money features. Money features depend on:

* launch country
* payment provider support
* KYC/KYB status
* account risk
* platform limits
* admin/provider approval

## Included

* Everything in Free
* Identity verification for trust features
* Verified-user trust indicator when approved
* Future money-trade access when money mode is launched and approved
* Ad-free experience if ads are introduced later
* AI support when available
* Better support priority
* Higher trust-based limits where safe

## Not Guaranteed

Plus does not guarantee:

* money access in unsupported countries
* unlimited trade limits
* bypassing review
* bypassing disputes
* bypassing safety checks

---

# Tier 3 — Pro

## Purpose

Pro is for professionals, freelancers, creators, agencies, and power users.

The main Pro value is advanced trade structure and workflow.

## Verification

Identity verification is required.

Future money access still requires payment-provider approval and platform safety checks.

## Included

* Everything in Plus
* Multi-person Trades
* Multi-Need / multi-Offer Trades
* Professional proposal management
* Portfolio/profile upgrades
* More media per Need/Offer
* Reusable Need/Offer templates
* Saved searches
* Match alerts
* Auto-repost expired Needs/Offers
* Basic analytics

  * views
  * saves
  * proposal rate
* Priority support/review where available

## Trade Scope

Free and Plus:

```txt
Person A ↔ Person B
```

Pro:

```txt
Person A ↔ Person B + Person C + Person D
```

or:

```txt
One professional Trade with multiple Needs and Offers
```

## Example

A restaurant creates one larger project:

* needs product photos
* needs menu translation
* needs short social content

Multiple professionals can participate in one Pro-level Trade/project.

---

# Tier 4 — Business

## Purpose

Business is for verified brands, restaurants, shops, studios, companies, and organizations.

## Verification

Business requires:

* identity verification for account owner/admin
* business or brand registration verification where meaningful
* additional review for higher-risk categories or larger limits

## Included

* Everything in Pro
* Business/brand profile
* Business verification badge when approved
* Team/member groundwork later
* Public business catalog
* Business-created goods/services/offers
* Campaign-style Needs
* Higher limits after review
* Business analytics
* Priority support/review
* Future voucher/perk/coupon tools
* Future brand/user campaign workflows

## Business Platform Offers

Business accounts may later create platform-level goods, services, vouchers, or perks.

Examples:

* restaurant meal voucher
* discount coupon
* free dessert card
* photography-for-meal offer
* shop credit/perk
* brand campaign offer

These items may later be:

* owned by users
* redeemed by users
* used inside Trades
* offered as part of Trades

## Important Money Warning

If users can buy business vouchers, coupons, cards, or perks inside Hellowhen, that becomes a future payments/business feature.

It may require:

* money provider integration
* refund rules
* expiry rules
* voucher/gift-card rules
* tax review
* consumer protection review
* business verification
* admin support tools

Do not include this in first beta.

---

# Summary

```txt
Free
Core marketplace access.
One-to-one service/goods Trades.
No money.

Plus
Verified individual trust tier.
Future money access when approved.
AI/ad-free/support benefits later.

Pro
Professional trading tools.
Multi-person and multi-item Trades.
Portfolio, templates, analytics, alerts.

Business
Verified brand/company tools.
Business catalog, vouchers/perks, campaigns, team tools later.
```

## Launch Rule

First beta launches with Free only.

Plus, Pro, and Business remain documentation/roadmap items until a later phase.