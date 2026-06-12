# Membership billing store review notes

> Documentation note: this is operational review guidance for Hellowhen Membership billing. It is not legal advice. Re-check Apple App Store Review Guidelines, Google Play billing policy, Stripe docs, tax/VAT rules, and local consumer-law requirements before any production billing launch.

## Status

BILLING9 completes documentation for the Membership billing foundation added in TIERS11 through BILLING8.

This document does not enable billing. It records how to describe the implemented architecture to Apple, Google, Stripe/web QA, and internal launch reviewers.

Current safe default remains:

```txt
Free first
No production billing launch unless the explicit billing flags are enabled intentionally
No Stripe Checkout inside the native iOS or Android app
No Airwallex Membership billing
No user-to-user payment processing
No wallet
No payouts
No escrow
No Cash Promise public launch
```

## Product explanation for reviewers

Hellowhen is an 18+ platform where adults can publish Needs, Offers, and Trades, then communicate with other users about possible exchanges.

Membership tiers are digital account features:

```txt
Free / Basic:
  core marketplace access

Plus:
  private organization tools such as Saved Library and Agenda
  AI-assistance quota when enabled
  customization utilities when enabled

Pro:
  future professional presentation and proposal utilities
```

Business / organization identity is separate from personal Membership tiers. A Business account is not simply a paid personal tier.

Hellowhen does not process user-to-user payments in the Membership system. Membership billing pays Hellowhen for digital app/account features only.

## Provider architecture to disclose internally

```txt
Web / PWA Membership checkout:
  Stripe Billing / Checkout
  Stripe Customer Portal for web billing management
  Stripe webhooks sync Hellowhen entitlement state

Native iOS Membership purchase:
  Apple StoreKit / App Store subscriptions
  Restore purchases path required
  Backend StoreKit sync validates before entitlement updates

Native Android Membership purchase:
  Google Play Billing subscriptions
  Restore/query purchases path required
  Backend Google Play purchase-token sync validates before entitlement updates

Backend:
  Normalized Membership entitlement resolver
  One app-facing tier/status result across providers
```

## Required native-app purchase boundaries

For native iOS and Android builds, do not show Stripe Checkout as the purchase path for Plus/Pro digital Membership features.

Allowed native labels:

```txt
iOS:
  Subscribe with Apple
  Restore purchases

Android:
  Subscribe with Google Play
  Restore purchases
```

Avoid native labels and review-note wording such as:

```txt
Pay with Stripe in the app
Open Stripe Checkout
Subscribe on our website from the app
External checkout for Plus
External checkout for Pro
```

Regional alternative billing/linking exceptions may exist, but Hellowhen should not rely on them without a separate legal/store-review decision.

## Apple App Review notes template

Use this as a starting point for App Store Connect review notes when iOS Membership purchases are enabled.

```txt
Hellowhen offers optional Plus/Pro digital Membership subscriptions that unlock app/account features such as private organization tools, Saved Library, Agenda, AI-assistance quota where enabled, and future Pro presentation tools.

The iOS app uses Apple StoreKit / App Store subscriptions for native Membership purchases. It does not use Stripe Checkout inside the iOS app for these digital Membership features.

Users can restore purchases from Account > Membership.

Hellowhen does not process user-to-user payments, wallet balances, payouts, escrow, or Cash Promise payments in this build. Trades and proposals are communication/organization flows only.

Business / organization identity is separate from personal Membership tiers and is not launched as a paid business onboarding flow in this build unless explicitly enabled.

Reviewer path:
1. Log in with the provided reviewer account.
2. Open Account > Membership.
3. Review Free / Basic, Plus, Pro, and Business identity separation.
4. On iOS, test Subscribe with Apple using sandbox products if the build has StoreKit Membership enabled.
5. Test Restore purchases.
6. Confirm Stripe Checkout is not opened from the iOS app.
7. Confirm reports, block/unblock, support, account deletion, Terms/Privacy, and 18+ age confirmation are available.
```

Before enabling iOS production Membership purchases, verify:

- App Store Connect subscription products exist for all shown Apple product IDs.
- Product names/descriptions match the visible in-app Membership benefits.
- StoreKit sandbox purchase and restore work on a development/TestFlight build.
- Backend App Store Server API validation credentials are configured.
- Server validation is enabled before entitlement mutation in production.
- Subscription screenshots for review clearly show the digital Membership benefit being offered.
- Account deletion and support paths are available in app.
- Cash Promise, wallet, payouts, escrow, and user-to-user payment wording are absent unless separately approved.

## Google Play review notes template

Use this as a starting point for Play Console review notes when Android Membership purchases are enabled.

```txt
Hellowhen offers optional Plus/Pro digital Membership subscriptions that unlock app/account features such as private organization tools, Saved Library, Agenda, AI-assistance quota where enabled, and future Pro presentation tools.

The Android app uses Google Play Billing subscriptions for native Membership purchases. It does not use Stripe Checkout inside the Android app for these digital Membership features.

Users can restore/query purchases from Account > Membership.

Hellowhen does not process user-to-user payments, wallet balances, payouts, escrow, or Cash Promise payments in this build. Trades and proposals are communication/organization flows only.

Business / organization identity is separate from personal Membership tiers and is not launched as a paid business onboarding flow in this build unless explicitly enabled.

Reviewer path:
1. Log in with the provided reviewer account.
2. Open Account > Membership.
3. Review Free / Basic, Plus, Pro, and Business identity separation.
4. On Android, test Subscribe with Google Play using Play testing products if the build has Google Play Membership enabled.
5. Test Restore purchases.
6. Confirm Stripe Checkout is not opened from the Android app.
7. Confirm reports, block/unblock, support, account deletion, Terms/Privacy, and 18+ age confirmation are available.
```

Before enabling Android production Membership purchases, verify:

- Play Console subscription products exist for all shown Google product IDs.
- Product names/descriptions match the visible in-app Membership benefits.
- Internal testing purchase and restore/query flows work.
- Backend Google Play Developer API validation credentials are configured.
- Server validation is enabled before entitlement mutation in production.
- License/test accounts are configured for Play Billing tests.
- Cash Promise, wallet, payouts, escrow, and user-to-user payment wording are absent unless separately approved.

## Stripe web billing notes

Stripe is only for web/PWA Membership checkout and web customer billing management.

Web flow:

```txt
/account/membership
  -> select Plus or Pro
  -> backend creates Stripe Checkout Session
  -> user completes Stripe-hosted checkout
  -> Stripe webhook confirms subscription
  -> Hellowhen updates SubscriptionState/User entitlement
```

Web management flow:

```txt
/account/membership
  -> Manage Membership billing
  -> backend creates Stripe Customer Portal Session
  -> user manages billing in Stripe-hosted portal
  -> Stripe webhook confirms subscription changes
  -> Hellowhen updates entitlement state
```

Boundary:

```txt
Checkout return alone must not grant access.
Customer Portal return alone must not change entitlement.
Stripe webhook confirmation is required.
```

## User-to-user payment boundary

Membership billing must not be described as payment protection for trades.

Forbidden Membership/store copy:

```txt
Protected payment for trades
Escrow for Hellowhen trades
Pay other users through Hellowhen
Receive payouts from Hellowhen
Wallet balance
Refund protection for user-to-user exchanges
Stripe payments between users
Airwallex payouts between users
```

Allowed Membership/store copy:

```txt
Optional Membership for digital Hellowhen features
Private organization tools
Saved Library
Agenda
AI assistance quota when enabled
Customization when enabled
Professional presentation tools when enabled
```

## Production billing launch gates

Before any production Membership billing launch, complete all of these:

- [ ] Final legal/consumer terms reviewed for recurring subscriptions, cancellation, refunds, and VAT/tax wording.
- [ ] Privacy policy and data safety disclosures updated for billing provider data.
- [ ] Apple product IDs created and reviewed if iOS purchases are enabled.
- [ ] Google Play products created and reviewed if Android purchases are enabled.
- [ ] Stripe products/prices configured in live mode if web checkout is enabled.
- [ ] Stripe webhook live endpoint configured and verified.
- [ ] Backend server validation enabled for Apple/Google production purchase sync.
- [ ] Test accounts prepared for Apple and Google reviewers.
- [ ] Support team can identify user tier, provider source, subscription status, and billing management path.
- [ ] Cash Promise/wallet/payout flags remain disabled unless separately reviewed.
- [ ] Store screenshots do not show disabled or unavailable paid features as if they are live.
- [ ] `/account/membership` explains Business identity separately from personal tiers.

## Default disabled flags checklist

Keep these disabled in production until the specific launch path is approved:

```env
STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=false
STRIPE_MEMBERSHIP_WEBHOOK_ENABLED=false
STRIPE_MEMBERSHIP_PORTAL_ENABLED=false
NEXT_PUBLIC_STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=false
NEXT_PUBLIC_STRIPE_MEMBERSHIP_PORTAL_ENABLED=false

EXPO_PUBLIC_IOS_STOREKIT_MEMBERSHIP_ENABLED=false
APPLE_MEMBERSHIP_PURCHASE_SYNC_ENABLED=false
APPLE_MEMBERSHIP_SERVER_VALIDATION_ENABLED=false

EXPO_PUBLIC_ANDROID_GOOGLE_PLAY_MEMBERSHIP_ENABLED=false
GOOGLE_PLAY_MEMBERSHIP_PURCHASE_SYNC_ENABLED=false
GOOGLE_PLAY_MEMBERSHIP_SERVER_VALIDATION_ENABLED=false

CASH_PROMISE_ENABLED=false
CASH_PROMISE_VISIBLE=false
EXPO_PUBLIC_CASH_PROMISE_ENABLED=false
EXPO_PUBLIC_CASH_PROMISE_VISIBLE=false
NEXT_PUBLIC_CASH_PROMISE_ENABLED=false
NEXT_PUBLIC_CASH_PROMISE_VISIBLE=false
```
