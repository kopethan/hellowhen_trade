# RELEASE-METADATA1 — Hellowhen 1.0.2 English (U.S.) App Store submission package

Use this document after RELEASE-VERSION1 and before the final App Review submission for Hellowhen 1.0.2. The historical 1.0.1 metadata package remains unchanged as release evidence and regression context.

The machine-copyable source for the exact English fields is:

```txt
docs/launch/appstore-i18n-102-en-US-metadata.json
```

This package is intentionally limited to capabilities enabled by the current iOS production EAS profile. The new app-update policy is operational infrastructure and remains disabled in production for the first 1.0.2 rollout. Do not add copy or screenshots for disabled payments, wallet, payouts, Cash Promise, Membership/subscriptions, Saved Library, Agenda, AI, ads, business tools, admin/debug surfaces, or other hidden features.

## 1. App Store Connect localization target

Keep Hellowhen as one app record. Do not create a second English app.

For version 1.0.2:

- preserve the already approved French localization and its screenshots;
- add `English (U.S.)` as a localization;
- keep Spanish as an in-app supported language for this release, without adding Spanish App Store metadata yet;
- use the same Hellowhen brand name in French and English;
- do not delete/recreate the French localization while adding English.

### Primary Language

French is the desired App Store metadata primary/fallback language as well as the native unsupported-language fallback.

In App Store Connect, open **App Information** and verify **Primary Language**:

1. If French is already the Primary Language, leave it unchanged.
2. If another language is primary and App Store Connect allows French to be selected because the French localization and matching screenshots were already approved in version 1.0.0, select French and save.
3. If App Store Connect does not permit the change yet, do not delete or rebuild localizations. Submit 1.0.2 with the existing French localization preserved and English (U.S.) added. Change Primary Language only after Apple's eligibility conditions are satisfied on a later editable version.

Primary App Store metadata language and the app binary's `CFBundleLocalizations` are separate settings. The existing native localization declaration remains unchanged for 1.0.2.

## 2. Exact English (U.S.) metadata

Copy these values exactly unless a final human review deliberately changes them and then updates both this document and the JSON metadata source.

### App name

```txt
Hellowhen
```

Keep the brand unchanged. Do not rename the English localization to `Hellowhen Trade` unless a separate branding decision changes the app name everywhere.

### Subtitle

```txt
Plans, needs & skill trades
```

### Promotional text

```txt
Turn what you need and what you can offer into practical exchanges. Discover Plans and Trades, connect through proposals, and use built-in safety tools.
```

Promotional text is optional. Use the text above for 1.0.2 if the field is enabled; otherwise leaving the field empty is acceptable and does not block the localization.

### Description

```txt
Hellowhen is a community exchange app for adults to organize Plans and turn what they need and what they can offer into practical exchanges with other people.

DISCOVER PLANS
Explore public Plans built around goals, places, and activities. Open a Plan to see its details and places, and use map actions for eligible offline stops.

EXPLORE TRADES
Browse Trades, Open Needs, and Open Offers. Each Trade brings together what one person needs and what they can offer in return.

CREATE YOUR OWN
Create and manage Needs and Offers, combine them into a Trade, or build a Plan around multiple places and activities. Starter ideas can help you begin with examples you can adapt before creating your own version.

CONNECT THROUGH PROPOSALS
Send private proposals tied to Trades and continue the conversation in private proposal threads. Trade owners can review proposals and accept or decline them.

PROFILES AND SAFETY
View public profiles, report inappropriate content or users, block or unblock other users, contact support, and request account deletion from within Hellowhen.

LANGUAGES
Hellowhen supports French, English and Spanish. When you choose the system language, supported device languages are followed automatically. Unsupported device languages fall back to French.

Hellowhen is intended for adults aged 18 and over.
```

### Keywords

```txt
barter,exchange,skills,community,help,needs,offers,plans,local,services,collaboration
```

Do not add `Hellowhen` to keywords because the app name is already searchable. Do not add names of unrelated apps or companies.

### What's New in Version 1.0.2

```txt
Improved the mobile experience across Plans, Me and Trade, with smoother keyboard behavior, clearer create and detail flows, and general reliability and release-quality improvements.
```

## 3. Shared URLs

Use the same production URLs for French and English. The linked Hellowhen web surfaces use the shared EN/FR/ES web i18n provider, so separate English-only URLs are not required for this release.

```txt
Support URL:        https://hellowhen.com/support
Marketing URL:      https://hellowhen.com
Privacy Policy URL: https://hellowhen.com/legal/privacy
```

Before submission, open all three from a logged-out browser and from the exact TestFlight build where linked. Confirm there is no Beta/testing/prototype presentation.

## 4. Exact App Review Notes for 1.0.2

Enter the reviewer demo username/password in App Store Connect's dedicated sign-in fields. Do not put reusable credentials in Git or in this document.

Paste this into **App Review Information → Notes**:

```txt
Hellowhen 1.0.2 is a normal update to the already released version 1.0.1.

This update improves the mobile experience across Plans, Me, and Trade, including smoother keyboard behavior, create/detail flow polish, and general reliability improvements. It also adds native app-update readiness for future releases. The production mobile release policy remains disabled for this first update-capable release, so the new update prompt is not activated by this submission.

The core product and business model are unchanged. The production navigation remains Plans, Me, and Trade. Reviewers can explore public Plans and Trades, create Needs and Offers, create Trades, send private proposals, view public profiles, report or block users, contact Support, and request account deletion.

For eligible offline Place/Plan map actions on iOS, Apple Maps is offered. Google Maps may also be offered as an optional external map provider where applicable.

The submitted production build does not expose payments, wallet, payouts, Cash Promise, subscriptions, paid Membership, ads, AI features, admin tools, debug diagnostics, or Beta/testing presentation.

Please use the demo account credentials entered in the App Review sign-in fields. Hellowhen supports French, English and Spanish; language and System/Light/Dark appearance can be changed from app settings. The Privacy Policy is https://hellowhen.com/legal/privacy and Support is https://hellowhen.com/support.
```

Do not reuse the old APPSTORE26 rejection reply or the historical 1.0.1 review note as the 1.0.2 review note. Those files remain historical regression evidence only.

## 5. English screenshot plan

The repository does not contain the already uploaded French App Store screenshot files, so this patch cannot identify their exact pixels or filenames. In App Store Connect, use the approved French localization as the visual reference and recreate the equivalent scenes in English wherever the French set already covers them.

Use the exact 1.0.2 production/TestFlight UI with the app language explicitly set to English. Keep the same device class, sample-account state, scene framing, and visual order as French when practical.

Recommended English story/order from the current production feature set:

| Order | Scene | What must be visible | Optional English overlay if the French screenshots already use overlays |
| --- | --- | --- | --- |
| 1 | Plans feed | `Plans` main tab with real production Plan cards/content | `Plan something together` |
| 2 | Plan Detail / offline Place | Plan details and an eligible offline Place/map action; Apple Maps must not be omitted where the action is shown | `Keep every place in one Plan` |
| 3 | Trade feed | `Trade` main tab with the production trade/deck experience | `Find the right exchange` |
| 4 | Trade Detail | Need + Offer sections on one Trade | `See both sides clearly` |
| 5 | Create Need or Offer | A clean English create flow with no keyboard/private data obscuring the UI | `Create what you need or offer` |
| 6 | Private proposal thread | Safe sample proposal/conversation with no real private data | `Connect through private proposals` |
| 7 | Me / Safety | `Me` plus a visible safety/support entry or Safety Center state | `Safety and support built in` |

If the approved French set contains fewer screenshots, do not add filler merely to reach seven. Apple accepts one to ten screenshots. Prioritize scenes 1, 3, 4, 5, 6, then 7. Use scene 2 when the French set already demonstrates Plans/Places or when map-provider parity needs to be visually clear.

### Screenshot capture rules

- Use a production build or the exact TestFlight candidate, never Expo Go or a development client.
- Set app language to English before every capture and verify no French/Spanish UI string remains in the captured scene except intentional user-generated content.
- Prefer safe sample content created for store capture; do not show real proposal text, email addresses, phone numbers, precise private addresses, support tickets, or credentials.
- Do not show Beta/Bêta, demo, prototype, debug diagnostics, feature-flag diagnostics, admin UI, hidden navigation, or unfinished-state copy.
- Do not show wallet, payouts, Cash Promise, payments, subscriptions/Membership, Saved Library, Agenda, AI, ads, or business features because the production profile disables them.
- Do not imply Hellowhen processes payments or guarantees an exchange.
- Keep Apple Maps visible as an eligible iOS map option if a screenshot includes the offline Place/Plan route action.
- Do not use screenshots from a build other than the exact 1.0.2 candidate unless the visual state is reproduced and verified on that candidate before submission.
- Keep screenshots opaque; do not export files with alpha/transparency.

For iPhone, upload the highest-resolution accepted screenshot size available for the device used in the French set and keep matching sizes across the localization. App Store Connect can scale high-resolution screenshots for smaller supported iPhone sizes.

`supportsTablet` is `false` in `apps/mobile/app.json`; the iPad compatibility-mode QA required by the release checklist remains a review regression test, not a request to create an iPad-native App Store screenshot set. If App Store Connect unexpectedly requires an iPad screenshot well for the selected binary, stop and verify the binary/device-family configuration before uploading substitute assets.

## 6. App Store Connect entry sequence

1. Open the existing Hellowhen app record and version 1.0.2.
2. Confirm the exact tested build 28-or-higher is selected only after TestFlight QA is complete.
3. Preserve the existing French localization and its screenshots.
4. From the language menu, add **English (U.S.)**.
5. Enter the English app name and Privacy Policy URL in shared App Information where requested.
6. Enter the subtitle, promotional text (optional), description, keywords, Support URL, Marketing URL, and What's New values from the JSON source.
7. Upload the English screenshots using the approved French set as the scene/layout reference.
8. Verify Primary Language using the rules in section 1; do not delete/recreate a localization just to force the primary-language setting.
9. Enter the normal reviewer account in the dedicated sign-in fields and paste the exact App Review Notes from section 4.
10. Confirm the version contains no attached subscription/In-App Purchase item for this release.
11. Confirm release mode (manual/automatic) matches the intended 1.0.2 rollout.
12. Complete the private evidence record and run the final preflight before submission.

## 7. Final localization checks

- [ ] French localization remains present and unchanged except for any separately approved French 1.0.2 What's New text required by App Store Connect.
- [ ] English (U.S.) localization exists.
- [ ] English name is `Hellowhen`.
- [ ] English metadata exactly matches `appstore-i18n-102-en-US-metadata.json`.
- [ ] English screenshots are captured from/verified against the exact 1.0.2 production candidate.
- [ ] Screenshot UI is English and contains no private credentials/data.
- [ ] No disabled or hidden first-release features appear in copy or screenshots.
- [ ] Support and Privacy URLs open correctly and show production multilingual pages.
- [ ] App Review sign-in credentials are stored only in App Store Connect/private release evidence.
- [ ] App Review Notes use the 1.0.2 normal-update text, not the APPSTORE26 rejection response.
- [ ] Primary Language is French if App Store Connect currently permits the already-approved French localization to be selected; otherwise the existing primary language is left unchanged for this submission and the reason is recorded privately.
- [ ] `npm run mobile:submission-preflight` passes.
- [ ] `npm run mobile:store-readiness` passes.

## Current Apple field limits captured by the preflight

The repository preflight validates the exact JSON source against these App Store Connect limits used for 1.0.2 preparation:

```txt
Name:              30 characters maximum
Subtitle:          30 characters maximum
Promotional text: 170 characters maximum
Description:     4000 characters maximum
Keywords:         100 bytes maximum
What's New:      4000 characters maximum
App Review Notes: 4000 bytes maximum
```

Apple can update App Store Connect requirements independently of this repository. Re-check the live App Store Connect fields and current Apple documentation immediately before final submission; if Apple changes a limit, update this release package and preflight instead of truncating copy manually in App Store Connect.
