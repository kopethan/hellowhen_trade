# Membership route smoke checklist

TIERS10 route decision: `/account/plans` is now a legacy route that redirects to `/account/membership`.

Membership is the account-facing tier explanation page. It may show Free / Basic, Plus, Pro, and a separated Business / organization identity explanation, but it must not start billing, checkout, identity verification, Stripe, native purchases, or Pro entitlement activation.

## Static route checks

Run from the repository root:

```powershell
git grep -n "/account/plans" -- apps packages docs scripts
```

Expected first-launch result:

```txt
apps/web/src/app/account/plans/page.tsx: legacy redirect comment
docs/tests/membership-route-smoke.md: checklist references only
```

No normal Account hub card, Plus prompt, Saved Library prompt, Agenda prompt, or Pro setup back link should point users to `/account/plans`.

## Web manual smoke

With default local launch flags, verify:

```txt
/account/membership loads from Account.
/account/plans redirects to /account/membership.
/account/membership shows no checkout or billing provider action.
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
Stripe checkout
Stripe Billing session
Apple in-app purchase button
Google Play billing button
identity verification launch
Pro entitlement mutation
Business onboarding activation
```
