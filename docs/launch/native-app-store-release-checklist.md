# Native App Store Release Checklist

> Documentation note: this checklist is operational readiness guidance, not legal advice. App Store and Play Store submissions should be reviewed against current platform rules before launch.

## Before native store submission

- Confirm `EXPO_PUBLIC_MONEY_FEATURES_VISIBLE=false`, `EXPO_PUBLIC_WALLET_VISIBLE=false`, `EXPO_PUBLIC_PAYOUTS_VISIBLE=false`, and `EXPO_PUBLIC_MONEY_TRADES_ENABLED=false`.
- Verify app icon, splash, bundle identifiers, version/build numbers, and store screenshots.
- Verify login/register/reset flows on iOS and Android devices.
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
