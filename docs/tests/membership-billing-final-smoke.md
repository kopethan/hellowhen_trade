# Membership billing final smoke checklist

Use this checklist before enabling any Membership billing flag in staging, TestFlight, Google Play internal testing, or production.

## Static code checks

Run from the repository root:

```powershell
git grep -n "account/plans" -- apps packages docs scripts
git grep -n "Stripe Checkout" -- apps/mobile apps/web docs
git grep -n "Cash Promise\|wallet\|payout\|escrow" -- apps packages docs
```

Expected:

```txt
/account/plans only appears in legacy redirect/checklist/roadmap context.
Stripe Checkout appears in web/API/docs only, not as a native mobile purchase path.
Cash Promise, wallet, payout, and escrow remain disabled or documented as unavailable unless separately approved.
```

## Web Stripe smoke

Flags for local/staging web checkout testing:

```env
SUBSCRIPTIONS_ENABLED=true
PLUS_ENABLED=true
STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=true
STRIPE_MEMBERSHIP_WEBHOOK_ENABLED=true
STRIPE_MEMBERSHIP_PORTAL_ENABLED=true
NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED=true
NEXT_PUBLIC_PLUS_ENABLED=true
NEXT_PUBLIC_STRIPE_MEMBERSHIP_CHECKOUT_ENABLED=true
NEXT_PUBLIC_STRIPE_MEMBERSHIP_PORTAL_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_MEMBERSHIP_WEBHOOK_SECRET=whsec_...
STRIPE_PLUS_MONTHLY_PRICE_ID=price_...
STRIPE_PLUS_YEARLY_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

Verify:

- [ ] `/account/membership` loads for an authenticated web user.
- [ ] Subscribe button creates a Stripe Checkout Session.
- [ ] Browser redirects to Stripe-hosted Checkout.
- [ ] Checkout return lands on `/account/membership`.
- [ ] Checkout return alone does not grant access before webhook confirmation.
- [ ] Signed `checkout.session.completed` webhook creates/updates Stripe `SubscriptionState`.
- [ ] `customer.subscription.updated` updates tier/status/period dates.
- [ ] `invoice.payment_failed` sets past-due state.
- [ ] `customer.subscription.deleted` removes active entitlement when no valid period remains.
- [ ] Customer Portal opens only for users with `SubscriptionState.provider=stripe` and `externalCustomerId=cus_...`.
- [ ] Customer Portal return alone does not mutate entitlement; webhook sync does.

## iOS StoreKit smoke

Use an iOS development build/TestFlight/sandbox build, not Expo Go.

Flags for iOS sandbox testing:

```env
EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE=true
EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true
EXPO_PUBLIC_PLUS_ENABLED=true
EXPO_PUBLIC_IOS_STOREKIT_MEMBERSHIP_ENABLED=true
APPLE_MEMBERSHIP_PURCHASE_SYNC_ENABLED=true
APPLE_MEMBERSHIP_SERVER_VALIDATION_ENABLED=true
APPLE_MEMBERSHIP_SERVER_ENVIRONMENT=sandbox
APPLE_MEMBERSHIP_BUNDLE_ID=com.hellowhen.app
APPLE_MEMBERSHIP_ISSUER_ID=...
APPLE_MEMBERSHIP_KEY_ID=...
APPLE_MEMBERSHIP_PRIVATE_KEY=...
```

Verify:

- [ ] Account shows Membership.
- [ ] Membership screen shows Apple purchase controls on iOS only.
- [ ] Product lookup returns App Store Connect subscription products.
- [ ] Subscribe with Apple opens the Apple purchase sheet.
- [ ] Completed purchase sends transaction data to `/subscriptions/apple/storekit-sync`.
- [ ] Backend rejects sync when server validation is disabled or credentials are missing.
- [ ] Backend grants Plus/Pro only when a validated Apple transaction maps to a known product.
- [ ] Restore purchases finds active Apple subscriptions and syncs them.
- [ ] Stripe Checkout is not opened from the iOS app.
- [ ] Google Play purchase controls are not shown on iOS.

## Android Google Play smoke

Use a Play internal testing build, not Expo Go.

Flags for Android internal testing:

```env
EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE=true
EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true
EXPO_PUBLIC_PLUS_ENABLED=true
EXPO_PUBLIC_ANDROID_GOOGLE_PLAY_MEMBERSHIP_ENABLED=true
GOOGLE_PLAY_MEMBERSHIP_PURCHASE_SYNC_ENABLED=true
GOOGLE_PLAY_MEMBERSHIP_SERVER_VALIDATION_ENABLED=true
GOOGLE_PLAY_MEMBERSHIP_PACKAGE_NAME=com.hellowhen.app
GOOGLE_PLAY_MEMBERSHIP_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PLAY_MEMBERSHIP_SERVICE_ACCOUNT_PRIVATE_KEY=...
```

Verify:

- [ ] Account shows Membership.
- [ ] Membership screen shows Google Play purchase controls on Android only.
- [ ] Product lookup returns Play Console subscription products.
- [ ] Subscribe with Google Play opens the Google Play purchase sheet.
- [ ] Completed purchase sends product ID and purchase token to `/subscriptions/google/play-sync`.
- [ ] Backend rejects sync when server validation is disabled or credentials are missing.
- [ ] Backend grants Plus/Pro only when a validated Google subscription maps to a known product.
- [ ] Restore/query purchases finds active Google subscriptions and syncs them.
- [ ] Stripe Checkout is not opened from the Android app.
- [ ] Apple purchase controls are not shown on Android.

## Cross-platform entitlement smoke

Prepare test users with overlapping provider states.

Verify:

- [ ] Active Pro beats active Plus.
- [ ] Active paid provider entitlement beats expired provider state.
- [ ] Canceled-but-valid-until remains active until the paid period ends.
- [ ] Expired/deleted/refunded/revoked provider state does not unlock Plus/Pro.
- [ ] Manual admin/promo/migration states are visible in reconciliation metadata.
- [ ] `/plus/me` and `/subscriptions/me` expose the same selected entitlement source.
- [ ] Web Membership page shows the resolved source/reconciliation summary.
- [ ] Mobile Membership screen shows resolved source/sync state.
- [ ] Payment state never bypasses account restrictions or moderation blocks.

## Store review packet smoke

Before external review, prepare:

- [ ] Apple reviewer notes from `docs/launch/membership-billing-store-review-notes.md` when iOS billing is enabled.
- [ ] Google reviewer notes from `docs/launch/membership-billing-store-review-notes.md` when Android billing is enabled.
- [ ] Reviewer test account credentials with safe sample content.
- [ ] Support/contact path available from Account.
- [ ] Account deletion path available from Account and public web.
- [ ] Terms, Privacy, and Safety/Community pages reachable.
- [ ] Store screenshots match enabled features only.
- [ ] Cash Promise, wallet, payout, escrow, and user-to-user payment claims are absent unless separately approved.
