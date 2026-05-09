# Money launch safety

Hellowhen Trade keeps real-money launch behind explicit safety gates. The product can run service-for-service trades without money, then test wallet/payout UX in demo mode before any production payment movement.

## Launch modes

`MONEY_LAUNCH_MODE` controls money features:

- `disabled`: all wallet money, money trades, payout account setup, and payout requests are blocked.
- `demo`: money UX can be tested with simulated wallet money and demo/test payout flows. No production money movement is enabled.
- `private_beta`: same as demo/beta behavior, but only users in `MONEY_PRIVATE_BETA_USER_IDS` can use money features.
- `production`: production money is only available when `MONEY_PRODUCTION_ENABLED=true`; Stripe transfers still require Stripe Connect transfer mode.

## Policy acknowledgement

Before using money features, users must acknowledge the current wallet, payout, refund, and dispute policy versions when `MONEY_POLICY_ACK_REQUIRED=true`.

The acknowledgement is stored in `MoneyPolicyAcknowledgement` by user and policy version. Bump `MONEY_POLICY_VERSION` or one of the specific policy version env values when policy copy changes and users need to accept again.

## Manual payout review

`MONEY_REQUIRE_MANUAL_PAYOUT_REVIEW=true` keeps payout requests in `requested` status. Admins must review the payout queue before marking paid, rejecting, cancelling, or retrying.

During launch, leave this enabled. Only turn it off after Stripe Connect, support, dispute, refund, and reconciliation workflows are proven.

## Admin checks

The admin payout console now loads `/admin/money-safety` to show launch mode, policy version, production money status, Stripe transfer status, manual review mode, policy acknowledgement count, and wallet exposure.

## Recommended launch defaults

```env
MONEY_LAUNCH_MODE=demo
MONEY_PRODUCTION_ENABLED=false
MONEY_POLICY_ACK_REQUIRED=true
MONEY_REQUIRE_MANUAL_PAYOUT_REVIEW=true
STRIPE_CONNECT_TRANSFER_MODE=false
```

These defaults keep production money movement off while still allowing product testing with clear safety copy and admin visibility.
