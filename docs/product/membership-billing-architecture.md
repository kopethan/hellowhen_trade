# Membership Billing Architecture Decision

## Status

TIERS11 decision document plus TIERS12 shared constants/types, BILLING1 entitlement resolver, BILLING2 Stripe web Checkout foundation, BILLING3 Stripe webhook entitlement sync, BILLING4 Stripe customer portal foundation, BILLING5 mobile subscription product metadata, and BILLING6 iOS StoreKit purchase/restore integration foundation.

This document is for implementation planning. BILLING2 can create Stripe Checkout sessions for web test-mode Membership purchases when explicitly enabled. BILLING3 can sync Stripe subscription webhook confirmations into the existing Hellowhen subscription state. BILLING4 can create Stripe Customer Portal sessions for existing Stripe Membership customers when explicitly enabled. BILLING5 can show a read-only native Membership screen and Apple/Google product identifiers when mobile flags are enabled. BILLING6 adds iOS StoreKit purchase and restore UI behind explicit flags, plus a backend StoreKit sync endpoint that requires Apple server validation before production. BILLING7 adds Android Google Play Billing purchase/restore UI behind explicit flags, plus a backend Google Play sync endpoint that requires server validation before production. BILLING8 exposes cross-platform entitlement reconciliation metadata. BILLING9 adds final store review and payment compliance notes. It still does not enable Airwallex, adopt RevenueCat, launch Business onboarding, or make production billing ready without a final billing launch review.

Current first-launch rule remains:

```txt
Free first
No live production subscription checkout
No live production native in-app purchases
No enabled native purchase flow without explicit billing flags and store-review readiness
No user-to-user payments
No wallet
No payouts
No Business public launch
```

## Decision summary

Use a normalized Hellowhen entitlement layer, with provider-specific billing systems feeding into it.

Recommended first production direction:

```txt
Web / PWA memberships:
  Stripe Billing

Native iOS memberships:
  Apple StoreKit / App Store in-app subscriptions

Native Android memberships:
  Google Play Billing subscriptions

Backend:
  Hellowhen entitlement resolver
  Provider webhooks / notifications update internal status
```

The Membership UI remains the account-facing explanation surface:

```txt
/account/membership
```

The legacy route stays redirected:

```txt
/account/plans -> /account/membership
```

## Why this architecture

Hellowhen Plus and Pro are digital membership tiers that unlock app functionality such as Saved Library, Agenda, AI assistance, customization, professional presentation tools, profile improvements, and future Pro utilities.

Because these are digital features inside the app, native apps need store-safe billing behavior. The safest default is:

```txt
iOS app users buy/restore through Apple.
Android app users buy/restore through Google Play.
Web users buy/manage through Stripe.
```

The backend should not treat Stripe, Apple, or Google as separate products in the product layer. They are provider sources for one internal entitlement state.

## Provider roles

| Provider | Role | First use | Do not use for |
| --- | --- | --- | --- |
| Stripe Billing | Web/PWA subscription checkout, subscription lifecycle, invoices, customer portal | Web Plus/Pro subscriptions | Native in-app purchase buttons for digital app features |
| Apple StoreKit / App Store | iOS subscription purchase, restore, server notifications | iOS Plus/Pro subscriptions | Web checkout replacement |
| Google Play Billing | Android subscription purchase, restore, server notifications | Android Plus/Pro subscriptions | Web checkout replacement |
| RevenueCat | Optional future entitlement aggregator | If cross-platform subscription operations become too complex | Required dependency for the first architecture patch |
| Airwallex | Possible later business/money infrastructure candidate | Business, global payments, KYB, payouts, multi-currency finance later | First Plus/Pro membership launch |


## BILLING9 review documents

Use these documents before any billing-enabled external review or production launch:

```txt
docs/launch/membership-billing-store-review-notes.md
docs/tests/membership-billing-final-smoke.md
```

They cover:

```txt
Apple App Review notes
Google Play review notes
Stripe web billing smoke checks
Test account preparation
User-to-user payment boundary wording
Mobile purchase boundaries
Production billing launch gates
```

## Stripe vs Airwallex decision

Prefer Stripe first for Membership billing.

Reasons:

- better fit for web SaaS subscriptions
- mature hosted Checkout and Customer Portal
- mature subscription lifecycle webhooks
- simpler test-mode workflow
- aligns with a web-first Membership launch

Keep Airwallex as a later candidate for:

```txt
business accounts
KYB-heavy organization flows
international money movement
payouts
wallet-like infrastructure
multi-currency business operations
```

Do not mix Airwallex money-provider work into first Membership billing.

## Apple and Google mobile rule

Do not add Stripe Checkout links/buttons inside the native iOS or Android app for Plus/Pro digital features by default.

Safe native purchase labels later:

```txt
iOS:
  Subscribe with Apple
  Restore purchases

Android:
  Subscribe with Google Play
  Restore purchases
```

Avoid native copy such as:

```txt
Go to our website to subscribe
Pay with Stripe from the app
Open web checkout for Plus
External checkout for Pro
```

Policy exceptions and regional alternative billing programs may exist, but they should not be used without a dedicated legal/store-review decision.

## Entitlement model

Keep the app-facing state normalized.

Current app-facing user state can remain:

```txt
subscriptionTier:
  free
  plus
  pro
  plus_later
  business_later

subscriptionStatus:
  none
  trialing
  active
  past_due
  canceled
  expired
```

Future provider source metadata should be separate from app-facing tier/status.

Recommended provider source values:

```txt
manual_admin
stripe
apple_app_store
google_play
promo
migration
revenuecat_later
```

Recommended future entitlement source fields, if/when schema work is needed:

```txt
providerSource
providerCustomerId
providerSubscriptionId
providerProductId
providerPriceId
currentPeriodStart
currentPeriodEnd
cancelAtPeriodEnd
lastProviderEventId
lastProviderSyncAt
```

Do not add these fields in TIERS11/TIERS12. TIERS12 only adds shared constants/types for sources and product handles.

## Entitlement resolution rule

The backend should resolve all provider signals into one account entitlement snapshot.

Recommended priority behavior:

```txt
1. Admin restrictions and account safety blocks always win.
2. Active/trialing paid entitlement unlocks the matching tier.
3. Higher tier beats lower tier if overlapping sources exist.
4. Canceled-but-valid-until remains active until the paid period ends.
5. Past-due may enter a grace period only if explicitly configured.
6. Expired/deleted/refunded/revoked provider state removes entitlement.
7. Business identity remains separate from personal membership tier.
```

Important safety rule:

```txt
Payment never bypasses moderation, account restrictions, identity checks, KYB/KYC, reports, or fraud controls.
```

## Business identity boundary

Business / organization identity is not a personal Membership tier.

Keep these concepts separate:

```txt
Personal membership tier:
  Free / Basic
  Plus
  Pro

Account identity type:
  personal account
  business / organization account
```

Future handle namespaces should stay separated:

```txt
Personal:
  /u/{handle}

Business / organization:
  /org/{handle}
```

Example:

```txt
/u/apple can be a personal user.
/org/apple can be an official organization account.
```

Do not let Membership billing collapse Business into a normal personal tier card.

## Web subscription flow later

Future web flow:

```txt
/account/membership
  -> choose Plus or Pro
  -> backend creates Stripe Checkout session
  -> Stripe handles payment details
  -> Stripe webhook confirms subscription
  -> backend updates entitlement snapshot
  -> user returns to Membership page
```

Future management flow:

```txt
/account/membership
  -> Manage membership
  -> backend creates Stripe Customer Portal session
  -> Stripe handles cancellation/payment method/invoice updates
  -> Stripe webhook updates entitlement snapshot
```

Do not store card details in Hellowhen.

## Native subscription flow later

Future iOS flow:

```txt
Mobile Membership screen
  -> StoreKit product lookup
  -> purchase Apple subscription
  -> app receives transaction
  -> backend validates transaction / server notification
  -> entitlement snapshot updates
  -> app refreshes /plus/me or Membership snapshot
```

Future Android flow:

```txt
Mobile Membership screen
  -> Google Play product lookup
  -> purchase Play subscription
  -> app receives purchase token
  -> backend validates purchase token / real-time developer notification
  -> entitlement snapshot updates
  -> app refreshes /plus/me or Membership snapshot
```

Both platforms must include a restore/sync path.

## RevenueCat option

RevenueCat can be evaluated later if direct Apple + Google + Stripe entitlement handling becomes too costly.

Possible future role:

```txt
Apple subscriptions -> RevenueCat
Google subscriptions -> RevenueCat
Stripe web subscriptions -> RevenueCat or backend bridge
RevenueCat entitlement -> Hellowhen backend entitlement snapshot
```

Do not adopt RevenueCat until the team compares:

```txt
implementation speed
monthly cost
vendor lock-in
web Stripe support needs
server-side entitlement guarantees
data export and migration path
App Store / Play setup complexity
```

## Product id naming convention

Recommended future product identifiers:

```txt
hellowhen_plus_monthly
hellowhen_plus_yearly
hellowhen_pro_monthly
hellowhen_pro_yearly
```

Provider-specific IDs may differ, but map them to these internal product handles.

Stripe price IDs should remain environment variables later:

```txt
STRIPE_PLUS_MONTHLY_PRICE_ID
STRIPE_PLUS_YEARLY_PRICE_ID
STRIPE_PRO_MONTHLY_PRICE_ID
STRIPE_PRO_YEARLY_PRICE_ID
```

BILLING5 documents Apple/Google product ids in shared metadata and `.env.example`. BILLING6 introduces the iOS StoreKit client integration and backend sync endpoint; final App Store Connect product setup, App Store Server API credentials, sandbox testing, and launch review are still required before live purchases. BILLING7 should still verify final Play Console product setup before Android purchases.

## Environment variables

BILLING2/BILLING3/BILLING4 add web Membership checkout, webhook, and customer portal variables, disabled by default:

```env
STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=false
STRIPE_MEMBERSHIP_WEBHOOK_ENABLED=false
STRIPE_MEMBERSHIP_WEBHOOK_SECRET=
STRIPE_MEMBERSHIP_PORTAL_ENABLED=false
STRIPE_MEMBERSHIP_PORTAL_RETURN_PATH=/account/membership?membership_portal=return
STRIPE_MEMBERSHIP_SUCCESS_PATH=/account/membership?membership_checkout=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_MEMBERSHIP_CANCEL_PATH=/account/membership?membership_checkout=cancelled
STRIPE_PLUS_MONTHLY_PRICE_ID=
STRIPE_PLUS_YEARLY_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_YEARLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=false
NEXT_PUBLIC_STRIPE_MEMBERSHIP_PORTAL_ENABLED=false
```

These rely on the existing API-only Stripe secret variable for API calls:

```env
STRIPE_SECRET_KEY=
```

`STRIPE_WEBHOOK_SECRET` remains the legacy wallet/credit/Connect webhook secret. Membership subscriptions use `STRIPE_MEMBERSHIP_WEBHOOK_SECRET` so entitlement sync does not depend on money/wallet webhook flags. Use Stripe test mode first. BILLING3 webhook sync confirms subscriptions. BILLING4 can open the hosted Stripe Customer Portal for existing Stripe Membership customers, but a complete billing launch still needs portal configuration review, cancellation smoke tests, tax/legal review, and store-review notes.

BILLING5 adds read-only mobile Membership preview and native product metadata flags. BILLING6 adds iOS StoreKit flags and backend Apple sync credentials. All are disabled by default:

```env
EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE=false
EXPO_PUBLIC_IOS_STOREKIT_MEMBERSHIP_ENABLED=false
EXPO_PUBLIC_IOS_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED=false
EXPO_PUBLIC_ANDROID_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED=false
EXPO_PUBLIC_APPLE_PLUS_MONTHLY_PRODUCT_ID=hellowhen.plus.monthly
EXPO_PUBLIC_APPLE_PLUS_YEARLY_PRODUCT_ID=hellowhen.plus.yearly
EXPO_PUBLIC_APPLE_PRO_MONTHLY_PRODUCT_ID=hellowhen.pro.monthly
EXPO_PUBLIC_APPLE_PRO_YEARLY_PRODUCT_ID=hellowhen.pro.yearly
EXPO_PUBLIC_GOOGLE_PLUS_MONTHLY_PRODUCT_ID=hellowhen_plus_monthly
EXPO_PUBLIC_GOOGLE_PLUS_YEARLY_PRODUCT_ID=hellowhen_plus_yearly
EXPO_PUBLIC_GOOGLE_PRO_MONTHLY_PRODUCT_ID=hellowhen_pro_monthly
EXPO_PUBLIC_GOOGLE_PRO_YEARLY_PRODUCT_ID=hellowhen_pro_yearly

APPLE_MEMBERSHIP_PURCHASE_SYNC_ENABLED=false
APPLE_MEMBERSHIP_SERVER_VALIDATION_ENABLED=false
APPLE_MEMBERSHIP_SERVER_ENVIRONMENT=sandbox
APPLE_MEMBERSHIP_BUNDLE_ID=com.hellowhen.app
APPLE_MEMBERSHIP_ISSUER_ID=
APPLE_MEMBERSHIP_KEY_ID=
APPLE_MEMBERSHIP_PRIVATE_KEY=
```

Provider secrets must never be exposed through `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables.

## Compliance and store-review notes

Before enabling real billing, verify the latest official policies and prepare store-review notes.

Reference pages to re-check before implementation:

```txt
Apple App Store Review Guidelines:
https://developer.apple.com/app-store/review/guidelines/

Apple auto-renewable subscriptions:
https://developer.apple.com/app-store/subscriptions/

Google Play payments policy:
https://support.google.com/googleplay/android-developer/answer/10281818?hl=en

Google Play billing system:
https://support.google.com/googleplay/android-developer/answer/1072599?hl=en

Apple App Store Server API:
https://developer.apple.com/documentation/appstoreserverapi

expo-iap / Expo in-app purchase library notes:
https://docs.expo.dev/guides/in-app-purchases/

Stripe Billing subscriptions:
https://docs.stripe.com/billing/subscriptions/overview

Stripe Customer Portal:
https://docs.stripe.com/billing/subscriptions/cancel
```

App review note should explain:

```txt
Hellowhen Plus/Pro are digital memberships.
Web checkout uses Stripe only on the web/PWA.
Native app purchase flows use Apple/Google where exposed.
Users can access entitlements across platforms after provider validation.
Hellowhen does not process user-to-user payments.
Hellowhen does not provide wallet, escrow, payout, or cash protection.
Business identity is separate from personal membership.
```

## Patch sequence after TIERS12

TIERS12 adds shared constants/types in:

```txt
packages/shared/src/membershipBilling.ts
```

Recommended next patches:

```txt
BILLING1 — Backend subscription entitlement foundation
BILLING2 — Stripe Billing web checkout foundation
BILLING3 — Stripe webhook entitlement sync
BILLING4 — Stripe customer portal
BILLING5 — Mobile subscription product metadata only
BILLING6 — iOS StoreKit purchase integration
BILLING7 — Android Google Play Billing integration
BILLING8 — Cross-platform entitlement reconciliation
BILLING9 — Final store review/payment compliance notes
```

## BILLING2 Stripe Checkout foundation

BILLING2 adds a web-only backend endpoint:

```txt
POST /subscriptions/checkout-session
```

The endpoint:

```txt
- requires auth and active account
- requires SUBSCRIPTIONS_ENABLED=true
- requires STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=true
- uses Stripe Checkout mode=subscription
- uses configured Stripe Price IDs
- creates/reuses a Stripe customer ID in SubscriptionState.externalCustomerId
- attaches Hellowhen user/product metadata to the Checkout Session and subscription
- redirects back to /account/membership
```

Important boundary:

```txt
Checkout success does not grant Plus or Pro in BILLING2.
BILLING3 webhook sync must confirm Stripe subscription status before entitlements update.
```

## BILLING4 Stripe customer portal foundation

BILLING4 adds a web-only backend endpoint:

```txt
POST /subscriptions/customer-portal-session
```

The endpoint:

```txt
- requires auth and active account
- requires SUBSCRIPTIONS_ENABLED=true
- requires STRIPE_MEMBERSHIP_PORTAL_ENABLED=true
- requires Stripe test-mode API configuration
- requires an existing SubscriptionState.provider=stripe row with externalCustomerId=cus_...
- creates a Stripe-hosted Customer Portal session
- redirects back to /account/membership
```

Important boundary:

```txt
The portal manages billing details in Stripe only. It does not grant entitlements directly.
BILLING3 webhook sync remains the source that updates Hellowhen subscription state after Stripe changes.
```


## BILLING5 mobile subscription product metadata

BILLING5 adds a native mobile read-only Membership screen and product-id metadata only.

Mobile route:

```txt
Membership
```

The Account hub can show a Membership row when:

```env
EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE=true
```

The screen can show disabled placeholder purchase actions only when the matching platform flag is enabled:

```env
EXPO_PUBLIC_IOS_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED=true
EXPO_PUBLIC_ANDROID_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED=true
```

These placeholders are not purchase flows. They do not call StoreKit, Google Play Billing, Stripe, RevenueCat, or backend entitlement mutation endpoints.

BILLING5 product metadata maps internal product handles to native store ids:

```txt
hellowhen_plus_monthly -> Apple hellowhen.plus.monthly / Google hellowhen_plus_monthly
hellowhen_plus_yearly  -> Apple hellowhen.plus.yearly  / Google hellowhen_plus_yearly
hellowhen_pro_monthly  -> Apple hellowhen.pro.monthly  / Google hellowhen_pro_monthly
hellowhen_pro_yearly   -> Apple hellowhen.pro.yearly   / Google hellowhen_pro_yearly
```

Important boundary:

```txt
BILLING5 is metadata and visibility only. BILLING6 adds iOS StoreKit purchase/restore and backend StoreKit sync behind flags. BILLING7 must add Android Google Play Billing purchase/restore and backend validation.
```

## TIERS12/BILLING1/BILLING2/BILLING3/BILLING4/BILLING5/BILLING6 non-goals

Do not add in TIERS11/TIERS12/BILLING1/BILLING2/BILLING3/BILLING4/BILLING5/BILLING6:

```txt
Google Play Billing integration
RevenueCat SDK
Airwallex SDK
schema migration
Android native checkout buttons
production subscription launch
Google Play purchase/restore flow
Business onboarding
identity verification
wallet
payouts
cash promise
```


## BILLING6 iOS StoreKit purchase integration foundation

BILLING6 adds iOS StoreKit purchase and restore UI behind explicit flags using the native in-app purchase library configured in the mobile app. This is an iOS-only foundation; Android remains out of scope until BILLING7.

Mobile behavior:

```txt
- Membership screen can show live StoreKit product rows on iOS only.
- StoreKit product lookup uses the Apple product ids from shared Membership metadata.
- Subscribe starts an App Store subscription purchase through StoreKit.
- Restore checks existing App Store purchases and submits matching Membership purchases for backend sync.
- Checkout through Stripe is still not exposed inside the native app.
```

Backend sync endpoint:

```txt
POST /subscriptions/apple/storekit-sync
```

The endpoint:

```txt
- requires auth and active account
- requires SUBSCRIPTIONS_ENABLED=true
- requires PLUS_ENABLED=true
- requires APPLE_MEMBERSHIP_PURCHASE_SYNC_ENABLED=true
- requires APPLE_MEMBERSHIP_SERVER_VALIDATION_ENABLED=true in production
- validates App Store Server API transaction data when server validation is enabled
- maps Apple product ids to internal Membership product handles
- updates SubscriptionState.provider=apple_app_store after validation/sync
- updates User.subscriptionTier/status only when the transaction is active
```

Development boundary:

```txt
- Local/dev sync can parse StoreKit transaction JWS data for sandbox testing.
- Production sync must use App Store Server API credentials.
- StoreKit does not work in Expo Go; use an iOS development build or production build.
- Google Play Billing remains out of scope.
- Server-to-server Apple subscription notifications remain a later hardening step.
```

### BILLING1 backend entitlement resolver

BILLING1 adds a backend-only entitlement resolver at:

```txt
apps/api/src/modules/subscriptions/membershipEntitlements.ts
```

The resolver intentionally does not create checkout, call Stripe, validate StoreKit receipts, or mutate billing data. It normalizes the existing `User.subscriptionTier/status` and optional `SubscriptionState` row into a single access decision that existing backend gates can use.

Rules:

```txt
- User.subscriptionTier/status remain the app-facing state.
- SubscriptionState is a provider/admin synchronization row.
- Active paid entitlements win over inactive/expired candidates.
- Higher tier wins over lower tier.
- Canceled subscriptions with a future period end remain active until that date.
- Manual admin grants still work through the same resolver.
```

This prepares the backend for Stripe, Apple App Store, Google Play Billing, promo, and migration sources without introducing a payment provider yet.


## BILLING3 Stripe webhook entitlement sync

BILLING3 adds a dedicated Membership webhook endpoint:

```txt
POST /subscriptions/stripe/webhook
```

This route is mounted before the normal JSON parser so Stripe signature verification can use the raw request body. It is separate from the legacy `/stripe/webhook` money/wallet/Connect route and does not depend on money feature visibility.

BILLING3 handles these Stripe events for Membership subscriptions:

```txt
checkout.session.completed
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed
```

The webhook maps configured Stripe Price IDs to internal product handles:

```txt
STRIPE_PLUS_MONTHLY_PRICE_ID  -> hellowhen_plus_monthly
STRIPE_PLUS_YEARLY_PRICE_ID   -> hellowhen_plus_yearly
STRIPE_PRO_MONTHLY_PRICE_ID   -> hellowhen_pro_monthly
STRIPE_PRO_YEARLY_PRICE_ID    -> hellowhen_pro_yearly
```

Sync target:

```txt
SubscriptionState.provider = stripe
SubscriptionState.externalCustomerId
SubscriptionState.externalSubscriptionId
SubscriptionState.tier/status
SubscriptionState.period/trial/cancel/past-due timestamps
User.subscriptionTier/status
```

Important boundaries:

```txt
Checkout redirect alone never grants access.
Stripe webhook confirmation is required before Stripe entitlements update.
The route is test-mode oriented until final billing launch review.
Mobile Apple/Google billing remains out of scope.
Customer Portal remains out of scope until BILLING4.
```

## BILLING7 Android Google Play Billing integration foundation

BILLING7 adds the Android side of native Membership purchases behind explicit flags.

Android client behavior:

```txt
Membership screen
  -> Google Play subscription product lookup
  -> Subscribe with Google Play
  -> Restore Google purchases
  -> POST /subscriptions/google/play-sync
  -> refresh Membership snapshot
```

Backend behavior:

```txt
POST /subscriptions/google/play-sync
  - auth required
  - active account required
  - SUBSCRIPTIONS_ENABLED=true required
  - PLUS_ENABLED=true required
  - GOOGLE_PLAY_MEMBERSHIP_PURCHASE_SYNC_ENABLED=true required
  - maps Google product id to internal Membership product handle
  - validates purchase token through Google Play Developer API when server validation is enabled
  - updates SubscriptionState/User only after a valid active Google subscription response
```

Google Play entitlement boundary:

```txt
Client purchase callback alone is not enough to grant access.
Backend validation must confirm the purchase token/product before SubscriptionState/User entitlement state changes.
```

BILLING7 still does not add:

```txt
RevenueCat
Google Real-time Developer Notifications
cross-platform reconciliation
production billing launch approval
Stripe inside mobile
Airwallex billing
```

BILLING8 should focus on cross-platform entitlement reconciliation and conflict handling across Stripe, Apple, Google, manual grants, promo grants, and migrations.


## BILLING8 reconciliation rule

Hellowhen resolves Membership access through one normalized entitlement snapshot before any Plus/Pro gate runs.

Current candidates:

- `User.subscriptionTier` / `User.subscriptionStatus` as the app-facing fallback state.
- `SubscriptionState` as the provider/admin synchronization state.

Selection order:

1. Active paid access wins over expired, canceled-without-time-left, past-due, or free candidates.
2. Higher personal tier wins over lower personal tier: Pro beats Plus, Plus beats Free.
3. If tier/status are otherwise equivalent, source priority decides: manual admin / migration / promo / Stripe / Apple / Google / RevenueCat-later metadata.
4. If a subscription is canceled but its current period or expiry date is still in the future, Hellowhen treats access as active until that date.

The resolver exposes a serialized `entitlement` block in `/plus/me` and `/subscriptions/me` so web and mobile can show:

- selected entitlement source
- selected candidate kind
- active candidate count
- whether `User.subscriptionTier/status` differs from resolved access
- whether app-facing state should be synced from provider state

BILLING8 does not add a new provider, a new purchase flow, a schema migration, RevenueCat, Apple server notifications, or Google real-time developer notifications.
