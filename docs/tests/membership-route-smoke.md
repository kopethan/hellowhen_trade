# Membership route smoke checklist

TIERS10 route decision: `/account/plans` is now a legacy route that redirects to `/account/membership`.

Membership is the account-facing tier explanation page. BILLING2 may show web Stripe Checkout actions only when Membership checkout flags and Stripe Price IDs are configured. BILLING3 may sync Stripe subscription webhooks into Hellowhen entitlements only when webhook flags and secrets are configured. BILLING4 may show a web Stripe Customer Portal action only for existing Stripe Membership customers when portal flags are configured. These patches must not start identity verification, native purchases, Business onboarding, wallet, payouts, or a production billing launch.

## Static route checks

Run from the repository root:

```powershell
git grep -n "/account/plans" -- apps packages docs scripts
```

Expected first-launch result should be limited to legacy-redirect documentation and checklist references, such as:

```txt
apps/web/src/app/account/plans/page.tsx: legacy redirect comment
docs/product/membership-billing-architecture.md: architecture note
docs/product/pro-feature-catalog-and-plan-copy.md: roadmap note
docs/tests/membership-route-smoke.md: checklist references
```

No normal Account hub card, Plus prompt, Saved Library prompt, Agenda prompt, or Pro setup back link should point users to `/account/plans`.

## Web manual smoke

With default local launch flags, verify:

```txt
/account/membership loads from Account.
/account/plans redirects to /account/membership.
/account/membership shows no checkout or billing portal action with default flags.
/account/membership can show web Stripe checkout buttons only when NEXT_PUBLIC_STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=true and the matching API flags are configured.
/account/membership can show a web Stripe customer portal button only when NEXT_PUBLIC_STRIPE_MEMBERSHIP_PORTAL_ENABLED=true and the account has Stripe Membership state.
Account hub Membership preview links to /account/membership.
Saved Library Plus prompt links to /account/membership.
Agenda Plus prompt links to /account/membership.
Pro setup back link points to /account/membership when the hidden Pro route is enabled for internal testing.
```

## Boundary checks

Membership must keep these boundaries visible:

```txt
Personal membership tier: Free / Basic, Plus, Pro.
Business / organization identity: separate from personal tiers.
Future organization handles: /org/{handle}.
Personal handles: /u/{handle}.
```

Do not reintroduce user-facing wording that treats Business as just another personal subscription tier.

## Provider safety checks

The Membership page and upgrade prompts must not include:

```txt
live Apple in-app purchase button
live Google Play Billing button
production billing launch notice
identity verification launch
Pro entitlement mutation
Business onboarding activation
```

## BILLING2 local Stripe checkout smoke

For local test-mode checkout only, configure:

```env
SUBSCRIPTIONS_ENABLED=true
PLUS_ENABLED=true
STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=true
NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED=true
NEXT_PUBLIC_PLUS_ENABLED=true
NEXT_PUBLIC_STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PLUS_MONTHLY_PRICE_ID=price_...
```

Then verify:

```txt
Authenticated web user can click Subscribe on web for Plus.
API returns a Stripe Checkout URL.
Browser redirects to Stripe-hosted Checkout.
Returning from Checkout lands back on /account/membership.
Checkout redirect alone does not change User.subscriptionTier/status.
A valid BILLING3 Stripe webhook must confirm the subscription before entitlement fields update.
```


## BILLING3 local Stripe webhook smoke

For local test-mode webhook sync only, configure the BILLING2 variables plus:

```env
STRIPE_MEMBERSHIP_WEBHOOK_ENABLED=true
STRIPE_MEMBERSHIP_WEBHOOK_SECRET=whsec_...
```

Use the dedicated Membership webhook URL, not the legacy money/wallet Stripe webhook URL:

```txt
POST /subscriptions/stripe/webhook
```

Verify with Stripe test mode or the Stripe CLI:

```txt
checkout.session.completed for a Membership Checkout session syncs SubscriptionState.provider=stripe.
customer.subscription.updated updates SubscriptionState tier/status/period fields.
customer.subscription.deleted marks the Stripe Membership subscription canceled/expired according to Stripe status.
invoice.payment_failed marks the Stripe Membership subscription past_due.
User.subscriptionTier/status update only after valid signed webhook events.
Unrelated Stripe wallet/credit/Connect events are ignored by the Membership webhook.
The legacy /stripe/webhook route is not required for Membership billing.
```


## BILLING4 local Stripe customer portal smoke

For local test-mode customer portal only, configure the BILLING2/BILLING3 variables plus:

```env
STRIPE_MEMBERSHIP_PORTAL_ENABLED=true
NEXT_PUBLIC_STRIPE_MEMBERSHIP_PORTAL_ENABLED=true
STRIPE_MEMBERSHIP_PORTAL_RETURN_PATH=/account/membership?membership_portal=return
```

Before testing, configure the Stripe Customer Portal in the Stripe Dashboard test-mode settings. Then verify:

```txt
Authenticated Stripe Membership user can click Manage Membership billing.
API returns a Stripe Customer Portal URL.
Browser redirects to Stripe-hosted Customer Portal.
Returning from the portal lands back on /account/membership.
Changing/canceling in the portal does not mutate Hellowhen directly from the redirect.
A valid BILLING3 Stripe webhook must sync the resulting subscription change.
Users without SubscriptionState.provider=stripe and externalCustomerId=cus_... cannot open the portal.
The portal endpoint does not depend on legacy wallet/money Stripe routes.
```

## BILLING5 mobile Membership metadata smoke

For mobile read-only Membership preview only, configure:

```env
EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE=true
EXPO_PUBLIC_PLUS_ENABLED=true
EXPO_PUBLIC_PLUS_PUBLIC=true
EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true
```

Then verify in the native app:

```txt
Account shows a Membership row.
Opening Membership shows Free / Basic, Plus, Pro, and Business identity boundary copy.
The current account status loads from /plus/me when logged in.
Apple and Google product IDs are shown as metadata only.
No StoreKit purchase starts.
No Google Play Billing purchase starts.
No Stripe web checkout opens from the native app.
No entitlement changes happen from opening the screen.
```

To test disabled native purchase placeholders only, set the platform flag for the device under test:

```env
EXPO_PUBLIC_IOS_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED=true
EXPO_PUBLIC_ANDROID_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED=true
```

Expected result:

```txt
iOS can show a disabled “Subscribe with Apple” placeholder.
Android can show a disabled “Subscribe with Google Play” placeholder.
Both buttons remain disabled and do not call any billing SDK.
```

## BILLING6 iOS StoreKit Membership smoke

For iOS StoreKit sandbox/development testing only, configure the BILLING5 mobile preview variables plus:

```env
EXPO_PUBLIC_IOS_STOREKIT_MEMBERSHIP_ENABLED=true
APPLE_MEMBERSHIP_PURCHASE_SYNC_ENABLED=true
APPLE_MEMBERSHIP_SERVER_VALIDATION_ENABLED=true
APPLE_MEMBERSHIP_SERVER_ENVIRONMENT=sandbox
APPLE_MEMBERSHIP_BUNDLE_ID=com.hellowhen.app
APPLE_MEMBERSHIP_ISSUER_ID=
APPLE_MEMBERSHIP_KEY_ID=
APPLE_MEMBERSHIP_PRIVATE_KEY=
```

Then verify on an iOS development build or production/sandbox build, not Expo Go:

```txt
Membership screen shows StoreKit enabled on iOS only.
The Apple product ids load from shared Membership metadata or EXPO_PUBLIC_APPLE_* overrides.
Subscribe with Apple starts the App Store subscription purchase flow.
A completed purchase submits transaction data to POST /subscriptions/apple/storekit-sync.
Backend sync validates App Store transaction data when server validation is enabled.
An active transaction updates SubscriptionState.provider=apple_app_store and User.subscriptionTier/status.
Restore purchases checks existing Apple purchases and syncs matching Membership subscriptions.
Stripe Checkout is not opened from the native app.
Android Google Play Billing remains out of scope for BILLING6.
If StoreKit product ids are not configured in App Store Connect, rows show “not found” and subscribe stays disabled.
```

Production boundary:

```txt
Do not enable APPLE_MEMBERSHIP_PURCHASE_SYNC_ENABLED=true in production without App Store Server API credentials.
Do not submit with live Apple purchase buttons until App Store Connect subscription products, sandbox tests, App Review notes, and support/cancellation copy are reviewed.
Server-to-server App Store subscription notifications are still a later hardening patch.
```

## BILLING7 Android Google Play Membership smoke

Flags for visibility-only Android testing:

```env
EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE=true
EXPO_PUBLIC_ANDROID_GOOGLE_PLAY_MEMBERSHIP_ENABLED=true
EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true
EXPO_PUBLIC_PLUS_ENABLED=true
```

Backend flags for Google Play sync testing:

```env
SUBSCRIPTIONS_ENABLED=true
PLUS_ENABLED=true
GOOGLE_PLAY_MEMBERSHIP_PURCHASE_SYNC_ENABLED=true
GOOGLE_PLAY_MEMBERSHIP_SERVER_VALIDATION_ENABLED=true
GOOGLE_PLAY_MEMBERSHIP_PACKAGE_NAME=com.hellowhen.app
GOOGLE_PLAY_MEMBERSHIP_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PLAY_MEMBERSHIP_SERVICE_ACCOUNT_PRIVATE_KEY=...
```

Smoke checklist:

```txt
- Android Membership screen shows Google Play enabled card only when EXPO_PUBLIC_ANDROID_GOOGLE_PLAY_MEMBERSHIP_ENABLED=true.
- Google Play card stays hidden on iOS.
- Subscribe action does not call Stripe.
- Restore action does not call Stripe.
- Client sends purchase token to POST /subscriptions/google/play-sync.
- Backend returns pending/not_configured if Google validation is not configured.
- Backend grants Plus/Pro only after validated Google subscription data maps to a known Membership product id.
- /plus/me and /subscriptions/me reflect the normalized entitlement after sync.
```


## BILLING8 entitlement reconciliation smoke

- [ ] `/account/membership` loads the resolved entitlement source tile.
- [ ] `/account/membership` loads the reconciliation tile.
- [ ] Mobile Membership preview shows the resolved source metric.
- [ ] Mobile Membership preview shows the reconciliation metric.
- [ ] Canceled subscriptions with a future period end still display active access until the end date.
- [ ] Expired provider state does not override an active paid app/admin state.
- [ ] Pro active state wins over Plus active state when both candidates exist.
- [ ] No Stripe checkout, Apple purchase, Google purchase, or entitlement mutation is triggered by merely viewing the reconciliation metadata.

## BILLING9 final review docs smoke

- [ ] `docs/launch/membership-billing-store-review-notes.md` exists.
- [ ] `docs/tests/membership-billing-final-smoke.md` exists.
- [ ] Apple review notes explain that iOS Membership purchases use StoreKit and that Stripe Checkout is not the native purchase path.
- [ ] Google review notes explain that Android Membership purchases use Google Play Billing and that Stripe Checkout is not the native purchase path.
- [ ] Stripe notes explain that Checkout/Portal returns do not mutate entitlements without webhook sync.
- [ ] User-to-user payment boundary notes say Hellowhen does not process, protect, escrow, refund, or pay out trades between users.
- [ ] Production billing launch gates keep Cash Promise, wallet, payouts, and escrow disabled unless separately reviewed.
