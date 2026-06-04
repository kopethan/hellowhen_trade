# CASH4 — Cash Promise store/safety checklist

Use this checklist before any build is submitted to Apple App Store review, TestFlight external testing, Google Play closed testing, Google Play production review, or public web launch.

## First-launch rule

Cash Promise is hidden by default and must stay unavailable in the first public launch.

Required defaults:

```env
CASH_PROMISE_ENABLED=false
CASH_PROMISE_VISIBLE=false
NEXT_PUBLIC_CASH_PROMISE_ENABLED=false
NEXT_PUBLIC_CASH_PROMISE_VISIBLE=false
EXPO_PUBLIC_CASH_PROMISE_ENABLED=false
EXPO_PUBLIC_CASH_PROMISE_VISIBLE=false
```

For first launch, reviewer notes and screenshots must describe Hellowhen as an 18+ service/skill/need/offer exchange. Do not market Cash Promise, paid helpers, wallet, payouts, escrow, checkout, Stripe, Airwallex, subscriptions, or ads.

## Meaning of Cash Promise when enabled later

Cash Promise is only a written outside-app promise between users. Hellowhen does not process, hold, protect, refund, or guarantee cash.

Required user-facing meaning:

```txt
Cash is arranged outside Hellowhen.
Hellowhen does not process, hold, protect, refund, or guarantee this cash.
Keep important details in the private deal chat.
Report suspicious behavior before completion.
```

## Forbidden wording

Do not use wording that makes Cash Promise look like an in-app transaction.

Forbidden for Cash Promise UI, screenshots, review notes, and support copy:

```txt
payment pending
paid through Hellowhen
protected payment
escrow
wallet balance
payout
checkout
Stripe
Airwallex
guaranteed payment
refund protection
payment protection
```

Use instead:

```txt
Cash Promise
Outside-app cash arrangement
Not processed by Hellowhen
Written promise only
```

## Store/submission safety gates

Before submission:

- `npm run mobile:store-readiness` must pass.
- `npm run cash-promise:safety-smoke` must pass.
- No wallet, payout, escrow, checkout, Stripe, Airwallex, payment SDK, or protected-payment wording appears in Cash Promise screenshots or store copy.
- The submitted app must not show Cash Promise unless a separate money/cash review explicitly approves it.
- The API production guard must reject enabled Cash Promise flags while first-launch guards are active.
- Mobile and web public flags must force Cash Promise off in production first-launch builds.
- Proposal/deal Cash Promise copy must continue to say `Not processed by Hellowhen`.
- Accepted Deal safety UI must remain available before Cash Promise is ever shown to users.

## Later launch notes

If Cash Promise is enabled in a later private beta:

- Use feature flags and test accounts only.
- Keep the amount capped by `CASH_PROMISE_MAX_AMOUNT_CENTS`.
- Keep Cash Promise separate from wallet, payment, escrow, payout, Stripe, and Airwallex models.
- Keep the acknowledgement required.
- Add app review notes explaining that Cash Promise is an outside-app written agreement and not a payment flow.
- Re-check Apple/Google policies and local legal/compliance requirements before public availability.
