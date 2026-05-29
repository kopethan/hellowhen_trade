# Business hidden guard smoke test

Business, Enterprise, sponsored placements, campaigns, and budget sandbox work must remain hidden for the first launch.

This smoke test verifies the Business batch stays fail-closed after patches B1-B9.

## Default first-launch expectation

Keep these disabled in local launch-mode testing and production:

```env
BUSINESS_ACCOUNTS_ENABLED=false
BUSINESS_ACCOUNTS_VISIBLE=false
BUSINESS_SPONSORED_CONTENT_ENABLED=false
BUSINESS_CAMPAIGNS_ENABLED=false
BUSINESS_BUDGETS_ENABLED=false

NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED=false
NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE=false
NEXT_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED=false
NEXT_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED=false
NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED=false

EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED=false
EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE=false
EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED=false
EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED=false
EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED=false
```

The first-launch production guard must also keep these off:

```env
MONEY_PROVIDER=none
ADS_PROVIDER=none
AI_PROVIDER=none
SUBSCRIPTIONS_ENABLED=false
PRO_ACCOUNTS_ENABLED=false
PLANS_ENABLED=false
```

## Static guard check only

Run this without starting the API:

```powershell
$env:BUSINESS_SMOKE_STATIC_ONLY="true"
npm run business:hidden-smoke
Remove-Item Env:\BUSINESS_SMOKE_STATIC_ONLY
```

Expected result:

```txt
Static Business hidden/first-launch guard checks: PASS
```

## Runtime hidden API check

Start the API with Business disabled, then run:

```powershell
npm run dev:api
```

In another terminal:

```powershell
npm run business:hidden-smoke
```

Expected runtime checks:

```txt
/business: business_accounts_disabled PASS
/business/profiles: business_accounts_disabled PASS
/business/invitations/not-a-real-token/accept: business_accounts_disabled PASS
```

These checks confirm the top-level Business API is blocked before auth, ownership, team, sponsored placement, campaign, or budget logic can run.

## Production guard check

For first launch, production startup should fail if any Business public/runtime flag is accidentally enabled while `FIRST_LAUNCH_GUARDS_ENABLED` is not explicitly disabled.

Examples that should fail in production:

```env
NODE_ENV=production
BUSINESS_ACCOUNTS_ENABLED=true
```

```env
NODE_ENV=production
NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE=true
```

```env
NODE_ENV=production
BUSINESS_BUDGETS_ENABLED=true
MONEY_PROVIDER=none
```

Do not bypass this with `FIRST_LAUNCH_GUARDS_ENABLED=false` for the first beta.

## What this does not test

This smoke test does not validate the later internal Business workflow with flags enabled. That belongs to a later Business QA phase after first-launch safety work.

It intentionally does not test:

- real sponsored feed placement rendering
- campaigns as a public surface
- business budgets with Stripe or Airwallex
- wallet balances, credits, payouts, or provider webhooks
- external ads SDKs
