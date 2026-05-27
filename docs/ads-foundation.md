# Ads foundation

Hellowhen Trade ads are intentionally disabled for the first public launch. This foundation exists only so future ad work can be added behind explicit feature flags without touching private or safety-sensitive surfaces.

## Default launch state

Keep these values for first launch:

```env
ADS_ENABLED=false
WEB_ADS_ENABLED=false
MOBILE_ADS_ENABLED=false
ADS_PROVIDER=none
ADS_DEBUG_PLACEHOLDERS=false
NEXT_PUBLIC_ADS_ENABLED=false
NEXT_PUBLIC_WEB_ADS_ENABLED=false
NEXT_PUBLIC_ADS_PROVIDER=none
NEXT_PUBLIC_ADS_DEBUG_PLACEHOLDERS=false
EXPO_PUBLIC_ADS_ENABLED=false
EXPO_PUBLIC_MOBILE_ADS_ENABLED=false
EXPO_PUBLIC_ADS_PROVIDER=none
EXPO_PUBLIC_ADS_DEBUG_PLACEHOLDERS=false
```

While first-launch guards are enabled, production config validation rejects enabled ad flags and non-`none` ad providers.

## Allowed future placements

Future ads may only be considered in public/discovery surfaces:

- `trades_feed`
- `public_discussion`
- `needs_list`
- `offers_list`

If `needs_list` or `offers_list` are still private owner inventory lists, do not insert ads there. Use these placements only if they become public discovery lists or another non-sensitive browsing surface.

## Forbidden placements

Never insert ads in:

- private proposal conversations
- private messages
- support tickets
- reports or moderation flows
- account security
- 2FA flows
- admin pages
- create/edit forms
- payment, wallet, payout, or sensitive account actions

Ads must never look like user-generated Trades, Needs, Offers, proposals, reports, or support messages.

## Current implementation

The current implementation provides:

- shared placement/provider constants in `@hellowhen/shared`
- `WebAdSlot`
- `NativeAdSlot`
- environment flags for web, native, and API guard validation

The ad slot components render nothing by default. In development only, they can render a clearly labeled placeholder when explicit debug flags are enabled. They do not load scripts, SDKs, tracking pixels, or network resources.

## Later real provider work

Before real AdSense or AdMob work, complete a separate privacy/legal scope:

1. Choose provider and mode: AdSense for web, AdMob for native, or contextual/non-personalized ads first.
2. Add EU/France consent handling before any cookies, mobile identifiers, personalized ads, analytics-based ads, or tracking.
3. Update Privacy Policy, cookie/consent copy, App Store privacy details, and Google Play Data Safety answers.
4. Add admin/runtime placement controls and frequency limits.
5. Add provider SDK/script integration only after consent and policy work is ready.

For EU/France, prefer contextual or non-personalized ads at the start and avoid personalized ads until consent, transparency, and store disclosures are complete.
