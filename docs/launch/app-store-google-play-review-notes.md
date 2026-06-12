# App Store / Google Play Review Notes

> Documentation note: this is launch-readiness guidance for reviewers and the Hellowhen team. It is not legal advice. Final Terms, Privacy, and safety wording must be reviewed before public launch.

## Product scope for first launch

Hellowhen Trade is a mobile-first marketplace for service, goods, and skill trades. First launch should stay focused on:

- creating Needs;
- creating Offers;
- creating Trades;
- sending proposals/messages tied to a Trade;
- reporting unsafe content or users;
- contacting support;
- requesting account deletion.

Money, wallet, payouts, Stripe, Airwallex, real-money trades, and Cash Promise must remain disabled unless a separate money/cash-launch review explicitly enables them. Cash Promise is hidden and disabled for first launch.

Google sign-in is disabled for first launch. Reviewers should use email/password registration or the prepared email/password demo account.

Hellowhen Trade is 18+ for first launch. Users must self-confirm that they are 18 or older during registration. Teen/minor accounts are not supported, and the app should not be marketed as directed to children.

## Demo reviewer setup

Prepare a normal reviewer account before submission:

- email: use a real inbox that can receive verification/reset messages;
- password: temporary strong password, rotated after review;
- language: English or French can be tested from Account settings;
- content: include at least one safe Need, Offer, and Trade for reviewer exploration.

Do not give reviewers admin credentials unless a reviewer specifically asks for admin/moderation access. Admin accounts should require strong credentials and two-step authentication outside local development.

## Review path inside the app

Suggested reviewer path:

1. Register or log in with the demo account.
2. Open Terms/Privacy/Safety from auth or Account.
3. Open Trades, Needs, and Offers.
4. Open a public profile.
5. Use report buttons without submitting abusive test content.
6. Open Support / Contact.
7. Confirm the register flow includes Terms/Privacy acceptance and 18+ age confirmation.
8. Open Account deletion request screen.
9. Confirm wallet, payouts, money trade features, and Cash Promise are not advertised or available in production.

## Safety features to mention in review notes

- Users can report profiles, trades, needs, offers, proposals, messages, and media.
- Users can block/unblock another user from public profiles.
- Admins can review reports, hide/restore content, restrict/suspend users, review media, and manage support tickets.
- Restricted users are blocked from marketplace write actions.
- Hidden/restricted content is filtered from public discovery and public profile routes.
- Support is available through authenticated app flows and the public support page.
- Account deletion can be requested in-app and through the public web deletion page.
- New accounts must confirm they are 18+; no date of birth or ID document is collected for first launch.

## Production readiness checks before submission

- No production API/web URL points to `localhost`.
- Production `JWT_SECRET` is strong and not the development fallback.
- Money flags stay off: `MONEY_PROVIDER=none`, `MONEY_FEATURES_VISIBLE=false`, `WALLET_VISIBLE=false`, `PAYOUTS_VISIBLE=false`, `MONEY_TRADES_ENABLED=false`, `CASH_PROMISE_ENABLED=false`, `CASH_PROMISE_VISIBLE=false`.
- Native public money flags stay off: `EXPO_PUBLIC_MONEY_FEATURES_VISIBLE=false`, `EXPO_PUBLIC_WALLET_VISIBLE=false`, `EXPO_PUBLIC_PAYOUTS_VISIBLE=false`, `EXPO_PUBLIC_MONEY_TRADES_ENABLED=false`, `EXPO_PUBLIC_CASH_PROMISE_ENABLED=false`, `EXPO_PUBLIC_CASH_PROMISE_VISIBLE=false`.
- Web public money flags stay off: `NEXT_PUBLIC_MONEY_FEATURES_VISIBLE=false`, `NEXT_PUBLIC_WALLET_VISIBLE=false`, `NEXT_PUBLIC_PAYOUTS_VISIBLE=false`, `NEXT_PUBLIC_MONEY_TRADES_ENABLED=false`, `NEXT_PUBLIC_CASH_PROMISE_ENABLED=false`, `NEXT_PUBLIC_CASH_PROMISE_VISIBLE=false`.
- Terms, Privacy, Community/Safety, Support, and Account Deletion pages are reachable from the app.

## Membership billing review note

If a later build enables Plus/Pro Membership billing, use the dedicated Membership billing review document before submission:

```txt
docs/launch/membership-billing-store-review-notes.md
```

For native builds, Plus/Pro digital Membership purchases must use the native store purchase path for the platform being tested:

```txt
iOS: Apple StoreKit / App Store subscriptions
Android: Google Play Billing subscriptions
Web/PWA: Stripe Billing
```

Do not present Stripe Checkout as the native iOS/Android purchase path for Plus/Pro digital Membership features unless a separate legal/store-review decision explicitly approves an applicable regional alternative billing flow.

Membership billing is separate from user-to-user payments. Hellowhen must not claim to process, protect, escrow, refund, or pay out trades between users.
