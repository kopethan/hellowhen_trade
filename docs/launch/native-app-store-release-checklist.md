# Native App Store Release Checklist

> Documentation note: this checklist is operational readiness guidance, not legal advice. App Store and Play Store submissions should be reviewed against current platform rules before launch.

## Before native store submission

- Follow the [APPSTORE26 production release runbook](./appstore26-production-release.md) for version `1.0.0`, remote build-number inspection, exact-binary QA, and submission.
- Run `npm run mobile:release-preflight` before starting the EAS production build.
- Run `npm run mobile:submission-preflight` before completing App Review Information or replying to the unresolved submission.
- Run `npm run mobile:app-review-smoke` and `npm run mobile:store-readiness` from the repository root.
- Complete `docs/launch/appstore26-ios-device-review-smoke.md` against the exact EAS production binary selected for App Store Connect.
- Follow `docs/launch/appstore26-app-review-resubmission.md` for the final notes, reviewer account, corrected-item workflow, and resubmission.
- Replay rejected-build regressions on iPhone and iPad compatibility mode: no general Beta presentation and Apple Maps offered for eligible Place/Plan route actions.
- Confirm `EXPO_PUBLIC_MONEY_FEATURES_VISIBLE=false`, `EXPO_PUBLIC_WALLET_VISIBLE=false`, `EXPO_PUBLIC_PAYOUTS_VISIBLE=false`, and `EXPO_PUBLIC_MONEY_TRADES_ENABLED=false`.
- Verify app icon, splash, bundle identifiers, marketing version `1.0.0`, iOS build number `26` or greater, and store screenshots.
- Verify login/register/reset flows on iOS and Android devices.
- Verify Google sign-in is disabled/hidden for first launch, with no placeholder OAuth URL scheme in native config.
- Verify registration requires Terms/Privacy acceptance and the 18+ age confirmation checkbox.
- Verify Terms and Privacy can be opened from registration and Account.
- Verify email verification links open `/auth/verify-email` and show success/failure states.
- Verify Account deletion can be opened from Account/Settings and creates a request.
- Verify the public Account Deletion page is reachable for store-console deletion URL requirements.
- Verify Settings includes Legal & Safety links.
- Verify Support includes safety/dispute links and ticket creation.
- Verify reports, block/unblock, and restricted-user protections on device.
- Verify language switching and French copy on device.
- Verify dark/light/system appearance persistence after app restart.
- Prepare store privacy disclosures that match implemented data collection and safety workflows.
- Keep payment/wallet/payout claims out of store copy until those features are explicitly enabled and reviewed.

## Membership billing addendum

Before submitting any build with Membership purchase controls enabled:

- Review `docs/launch/membership-billing-store-review-notes.md`.
- Run `docs/tests/membership-billing-final-smoke.md`.
- Confirm iOS Plus/Pro digital Membership purchases use Apple StoreKit, not Stripe Checkout.
- Confirm Android Plus/Pro digital Membership purchases use Google Play Billing, not Stripe Checkout.
- Confirm Restore purchases is visible and works for the enabled native platform.
- Confirm backend server validation is enabled before provider sync can mutate entitlements in production.
- Confirm store screenshots and review notes do not imply Hellowhen processes user-to-user payments, wallet balances, payouts, escrow, or Cash Promise payments.
