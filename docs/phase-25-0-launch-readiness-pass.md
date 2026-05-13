# Phase 25.0 — Launch readiness pass: terms, privacy, safety copy, and release checklist

## Scope completed

Phase 25.0 adds a launch-readiness structure without enabling money features or changing feed/deck/proposal logic.

Implemented surfaces:

- Web Legal & Safety center at `/legal`.
- Web pages:
  - `/legal/terms`
  - `/legal/privacy`
  - `/legal/safety`
  - `/legal/refund-dispute`
- Native Legal & Safety screen with the same Terms, Privacy, Safety, and Refund/Dispute content.
- Auth registration links to Terms and Privacy.
- Account links to Legal & Safety.
- Settings links to Legal & Safety.
- Support links to Safety and Refund/Dispute policy.
- English and French localized policy copy.
- Placeholder policy docs and launch checklists.

## Important constraint

This phase is not legal finalization.

The policy docs in `docs/policies/` are product/legal-readiness drafts only. They are not legal advice and must be reviewed by a qualified lawyer before public launch.

## Non-goals

- No feed/deck behavior changes.
- No proposal logic changes.
- No wallet, payout, Stripe, Airwallex, or provider enablement.
- No legal claims that the product is compliant in a particular country.
- No production-money refund flow.
- No changes to admin moderation decisions beyond policy-link visibility.

## QA checklist

1. Open `/legal` and each legal subpage in English and French.
2. Register screen: confirm Terms and Privacy links are visible and open the correct pages.
3. Account: confirm Legal & Safety appears as a menu item.
4. Settings: confirm Legal & Safety link appears.
5. Support: confirm Safety and Refund/Dispute links appear.
6. Expo: confirm Account, Settings, Support, and Register expose the native legal screens.
7. Confirm money feature flags remain off in `.env.example` and runtime env.
8. Run typecheck/build before merging.
