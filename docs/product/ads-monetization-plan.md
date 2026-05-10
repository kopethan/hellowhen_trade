# Ads Monetization Plan

## Purpose

Hellowhen Trade may use ads as a future monetization layer for Free users while keeping the core marketplace accessible.

Ads should never damage the main product experience.

The goal is:

```txt
Free users can use the marketplace.
Ads can help support free usage.
Paid users can remove ads if ads are enabled.
```

Ads should be treated as a configurable product layer, not as a core dependency.

## Core Principle

Ads must be:

* clearly labeled
* non-blocking
* not deceptive
* not placed in sensitive flows
* disabled by feature flag by default
* removable for paid users if the plan includes ads-free access

Do not show ads in ways that interrupt trust, proposals, safety, support, or trade completion.

## Provider Strategy

Use different ad providers by platform and maturity.

```txt
Web:
  Google AdSense

Mobile:
  Google AdMob

Later mobile scaling:
  AdMob Mediation
  AppLovin MAX
  Unity LevelPlay
  Meta Audience Network through mediation
```

## Why Start With Google

Google is the simplest starting point because:

* AdSense is a standard web monetization provider.
* AdMob is a standard mobile app monetization provider.
* AdMob can later mediate other ad networks.
* One Google stack is easier to manage early than many direct ad SDKs.

## Provider Roles

### Google AdSense

Best for:

* web app ads
* mobile web ads
* simple display ads
* responsive placements
* low-maintenance web monetization

Use for:

```txt
apps/web
```

Avoid using AdSense in a way that makes the mobile web app feel crowded.

### Google AdMob

Best for:

* iOS app ads
* Android app ads
* native app placements
* feed ads
* banner ads
* rewarded ads
* mediation later

Use for:

```txt
apps/mobile
```

Important Expo note:

AdMob mobile integration requires native code through a library such as `react-native-google-mobile-ads`.

That means it cannot be tested inside normal Expo Go. It requires a custom development build / EAS build.

### AdMob Mediation

Best for:

* adding multiple ad sources through AdMob
* letting ad networks compete
* improving fill rate
* improving eCPM later

Use after basic AdMob works.

Possible mediated networks later:

* AppLovin
* Meta Audience Network
* Unity Ads
* other supported networks

### AppLovin MAX

Best for:

* advanced mobile ad mediation
* high-volume apps
* stronger ad revenue optimization
* multiple SDK bidders and networks

Use later if Hellowhen has enough mobile traffic to justify a more complex mediation setup.

### Unity LevelPlay

Best for:

* mobile ad mediation
* rewarded ads
* interstitials
* banners
* native ads
* larger-scale monetization testing

Use later as an alternative to AppLovin MAX or AdMob Mediation.

### Meta Audience Network

Best for:

* extra mobile ad demand
* bidding through mediation
* global advertiser demand

Use through mediation rather than direct integration at first.

## Recommended Provider Order

```txt
1. Web AdSense
2. Mobile AdMob
3. AdMob Mediation
4. Add AppLovin / Meta / Unity as mediated sources
5. Consider AppLovin MAX or Unity LevelPlay only after meaningful traffic
```

## Ad Formats

### Preferred Formats

Use these first:

```txt
Native ad card
Small banner
Sponsored feed card
Optional rewarded ad
```

### Use Carefully

```txt
Interstitial ad
App-open ad
Rewarded interstitial
```

### Avoid By Default

```txt
Auto-playing video in core flows
Full-screen ads during creation
Full-screen ads during proposal/chat
Ads that look like real Trades
Ads that block support/safety actions
```

## Hellowhen Ad Placement Rules

### Good Placements

Ads can appear in:

```txt
Trades feed after several cards
Needs list after several items
Offers list after several items
Account page lower section
Support page lower section
Empty states, softly
After successful creation confirmation
```

### Bad Placements

Do not show ads in:

```txt
Create Need form
Create Offer form
Create Trade form
Trade Detail main content
Proposal composer
Accepted proposal conversation
Report/dispute flow
Login/register flow
Profile edit form
Settings form
Support ticket form before submit
```

## Mobile Deck Ads

The mobile deck is a sensitive product surface.

Ads should not interrupt every swipe.

Recommended behavior:

```txt
Show an ad card only after enough organic cards.
Never make the first deck card an ad.
Clearly label as Sponsored.
Do not make ad cards look like real Trades.
Allow normal pass/skip behavior.
Do not block opening real Trade details.
```

Example rule:

```txt
After 8–12 organic deck cards, insert 1 sponsored card.
```

Ad cards should be visually different from Trade cards.

Suggested label:

```txt
Sponsored
```

Not:

```txt
Recommended Trade
```

## Web Feed Ads

For web, ads can appear as soft feed cards.

Recommended behavior:

```txt
Show after multiple organic cards.
Use a clear Sponsored label.
Keep ad height reasonable.
Do not place above the first real Trade.
Do not place between Need and Offer content inside detail pages.
```

## Account Page Ads

Account page can contain a low-priority ad area near the bottom for Free users.

Do not show ads above:

* profile
* settings
* support
* logout

## Support Page Ads

Support page can contain a low-priority ad area only after the main support actions.

Do not show ads before:

* contact support
* submit issue
* safety/report resources

## Rewarded Ads

Rewarded ads can be considered later, but only for optional benefits.

Possible rewarded benefits:

```txt
Extra AI writing assist
Extra profile boost preview
Extra saved search slot
Temporary cosmetic profile option
```

Avoid rewarded ads for:

```txt
Sending proposals
Creating Trades
Accessing support
Removing safety limits
Bypassing verification
Bypassing moderation
```

Rewarded ads should never unlock trust or safety features.

## Interstitial Ads

Interstitial ads should be avoided in most Hellowhen flows.

If used later, only show them at natural breaks, such as:

```txt
After a user finishes browsing a session
After returning to feed from a non-critical screen
After successful non-sensitive completion
```

Never show interstitials:

```txt
before saving a Need
before saving an Offer
before saving a Trade
before sending a proposal
before reporting a user
before contacting support
during onboarding
```

## Plus Ads-Free Rule

If ads are enabled, Plus can include:

```txt
Ads-free experience
```

But the wording should be conditional:

```txt
Ads-free if ads are introduced.
```

Do not promise ads-free before ads exist in the product.

## Plan-Based Ads

### Free

Possible ad behavior:

```txt
Light ads enabled
Feed sponsored cards
Small account/support placements
Optional rewarded ads
```

### Plus

```txt
No standard ads
Optional rewarded ads only if user chooses them
```

### Pro

```txt
No standard ads
No ads in professional workflows
```

### Business

```txt
No standard ads in business workspace
No ads in campaign/business management flows
```

## Ads and AI

Ads can help support Free AI usage later.

Possible model:

```txt
Free:
  limited AI usage
  optional rewarded ad for extra AI assist

Plus:
  more AI usage
  ads-free

Pro:
  higher AI usage
  no ads

Business:
  business AI tools
  no ads in business workflows
```

Do not make users watch ads for safety, support, reporting, or dispute help.

## Feature Flags

Ads should be fully controlled by feature flags.

Example flags:

```txt
ADS_ENABLED=false
WEB_ADS_ENABLED=false
MOBILE_ADS_ENABLED=false

ADS_FREE_PLAN_PLUS=true
ADS_FREE_PLAN_PRO=true
ADS_FREE_PLAN_BUSINESS=true

ADS_FEED_ENABLED=false
ADS_DECK_ENABLED=false
ADS_ACCOUNT_ENABLED=false
ADS_SUPPORT_ENABLED=false
ADS_REWARDED_ENABLED=false
ADS_INTERSTITIAL_ENABLED=false
ADS_APP_OPEN_ENABLED=false
```

## Environment Variables

Example config:

```txt
ADS_PROVIDER_WEB=adsense
ADS_PROVIDER_MOBILE=admob
ADS_MEDIATION_PROVIDER=none

GOOGLE_ADSENSE_CLIENT_ID=
ADMOB_ANDROID_APP_ID=
ADMOB_IOS_APP_ID=

ADMOB_ANDROID_BANNER_UNIT_ID=
ADMOB_IOS_BANNER_UNIT_ID=

ADMOB_ANDROID_NATIVE_UNIT_ID=
ADMOB_IOS_NATIVE_UNIT_ID=

ADMOB_ANDROID_REWARDED_UNIT_ID=
ADMOB_IOS_REWARDED_UNIT_ID=

ADMOB_TEST_MODE=true
```

Use test ad units in development.

Never use production ad units in local development unless the provider explicitly allows it.

## Backend vs Frontend Responsibilities

### Backend

Backend should decide:

* whether ads are enabled
* whether the user plan is ads-free
* which placements are allowed
* how often ads can appear
* whether rewarded ad benefits are allowed
* whether ad experiments are active

### Frontend

Frontend should:

* render ad placements
* respect placement rules
* hide ads for ads-free users
* label ads clearly
* avoid ads in blocked flows
* use test IDs in development

## Recommended API Shape

Possible backend route:

```txt
GET /ads/config
```

Example response:

```json
{
  "adsEnabled": true,
  "provider": "admob",
  "adsFree": false,
  "placements": {
    "feed": true,
    "deck": true,
    "account": false,
    "support": false,
    "rewarded": false,
    "interstitial": false
  },
  "frequency": {
    "feedEveryItems": 10,
    "deckEveryCards": 12
  },
  "testMode": true
}
```

## Web Implementation Notes

Recommended web module shape:

```txt
apps/web/src/features/ads/
  AdsProvider.tsx
  WebAdSlot.tsx
  SponsoredCard.tsx
  adsConfig.ts
```

Possible placements:

```txt
TradesFeedSponsoredCard
AccountFooterAd
SupportFooterAd
```

Do not add ads directly into every screen. Use shared components.

## Mobile Implementation Notes

Recommended mobile module shape:

```txt
apps/mobile/src/features/ads/
  AdsProvider.tsx
  MobileAdSlot.tsx
  SponsoredDeckCard.tsx
  RewardedAdButton.tsx
  adsConfig.ts
```

Mobile AdMob requires a native build.

Do not add mobile ad SDK dependencies until the project is ready for a custom dev client / EAS build.

## Ad Labeling

Every ad must be clearly labeled.

Allowed labels:

```txt
Sponsored
Ad
Advertisement
```

Avoid labels like:

```txt
Recommended
Featured Trade
Suggested for you
Best match
```

unless the item is actually a real Hellowhen Trade and not paid advertising.

## Content Safety

Hellowhen has user-generated content and should keep ads away from sensitive content.

Avoid placing ads next to:

* reports
* disputes
* safety warnings
* support crisis messages
* suspicious content
* moderation states
* blocked users
* identity verification flows
* payment/verification flows if money exists later

## Privacy and Consent

Ads may require privacy disclosures and user consent depending on platform, country, and provider.

Before enabling ads publicly, prepare:

* privacy policy update
* cookie/ad consent for web where required
* App Store privacy disclosures
* Play Store data safety disclosures
* ATT prompt strategy for iOS if tracking is used
* child/age-sensitive content review if relevant
* ad personalization settings if needed

## Analytics

Track ad performance without harming privacy.

Useful metrics:

* ad impressions
* ad clicks
* fill rate
* eCPM
* placement revenue
* ad errors
* ad load time
* ad frequency per user
* ad dismiss/skip behavior
* retention impact
* proposal/send completion impact

Important product metrics:

```txt
Do ads reduce Trade creation?
Do ads reduce proposal sending?
Do ads reduce retention?
Do ads make the feed feel worse?
```

If ads hurt core marketplace activity, reduce or remove them.

## Admin Controls

Admin should eventually be able to:

* enable/disable ads globally
* enable/disable ads by platform
* enable/disable placements
* change ad frequency
* disable ads for a user
* disable ads during incidents
* view ad revenue/performance
* view ad errors
* run A/B tests

## A/B Testing

Ad placement should be tested carefully.

Possible experiments:

```txt
No ads
Feed ad every 12 cards
Feed ad every 8 cards
Account-only ads
Native card vs banner
Rewarded AI assist
```

Measure:

* retention
* feed browsing
* Need creation
* Offer creation
* Trade creation
* proposal sending
* support complaints
* revenue

## Prohibited Product Behavior

Ads must not:

* look like user-generated Trades
* block safety/report/support
* appear in forms before saving
* pressure users into purchases
* claim paid ads are verified Trades
* unlock verification
* unlock money features
* bypass spam/risk limits
* bypass media review
* auto-click or encourage accidental clicks
* hide close/skip controls where required

## Suggested Development Order

```txt
1. Add ads documentation and feature flags.
2. Add backend /ads/config route.
3. Add web placeholder ad slots with ADS_ENABLED=false.
4. Add web AdSense integration behind WEB_ADS_ENABLED.
5. Add mobile ad placeholder slots with MOBILE_ADS_ENABLED=false.
6. Prepare EAS/custom dev-client setup.
7. Add AdMob test integration.
8. Add production AdMob IDs only when ready.
9. Add plan-based ads-free behavior.
10. Add mediation only after meaningful traffic.
```

## Summary

Recommended Hellowhen ads strategy:

```txt
Web:
  Google AdSense first

Mobile:
  Google AdMob first

Scaling:
  AdMob Mediation
  AppLovin MAX
  Unity LevelPlay
  Meta Audience Network through mediation

Best formats:
  native sponsored feed/deck cards
  small banners in low-risk areas
  optional rewarded ads later

Avoid:
  intrusive interstitials
  ads inside creation/proposal/support flows
  ads that look like real Trades
```

Ads should support the Free plan without weakening the core marketplace experience.

```
::contentReference[oaicite:1]{index=1}
```

[1]: https://admob.google.com/home/?utm_source=chatgpt.com "Google AdMob - Earn More With Mobile App Monetization"
