# Guide replay testing notes

Use these browser `localStorage` keys when testing first-time guide prompts and replay completion locally.

## Feature prompt dismissal keys

- `hellowhen.plans.guideIntro.seen.v1`
- `hellowhen.trade.homeIntro.seen.v1`

These keys only dismiss the matching feed prompt. Reset one key to retest only that feed prompt.

## Guide completion keys

- `hellowhen_web_onboarding_guide_completed_v1:global`
- `hellowhen_web_onboarding_guide_completed_v1:plans`
- `hellowhen_web_onboarding_guide_completed_v1:trade`

Global, Plans, and Trade completion are guide-scoped. Completing one guide should not complete or hide prompts for the other guide types.

## Manual reset snippets

```js
localStorage.removeItem('hellowhen.plans.guideIntro.seen.v1');
localStorage.removeItem('hellowhen.trade.homeIntro.seen.v1');
localStorage.removeItem('hellowhen_web_onboarding_guide_completed_v1:global');
localStorage.removeItem('hellowhen_web_onboarding_guide_completed_v1:plans');
localStorage.removeItem('hellowhen_web_onboarding_guide_completed_v1:trade');
```

If testing while signed in, also clear the user-scoped completion variants that append the user id, for example:

```js
Object.keys(localStorage)
  .filter((key) => key.startsWith('hellowhen_web_onboarding_guide_completed_v1:'))
  .forEach((key) => localStorage.removeItem(key));
```

Do not add a visible production reset button unless a dev-only settings area exists.

## Native mobile AsyncStorage keys

Feature prompt dismissal on native mobile is separate from web localStorage:

- `hellowhen_mobile.plans.guideIntro.seen.v1`
- `hellowhen_mobile.trade.homeIntro.seen.v1`

Native guide completion keys are also stored in AsyncStorage and are guide-scoped:

- `hellowhen_onboarding_guide_completed_v1:global`
- `hellowhen_onboarding_guide_completed_v1:plans`
- `hellowhen_onboarding_guide_completed_v1:trade`

The older native trade guide key is still read/written for compatibility:

- `hellowhen_onboarding_guide_completed_v1`

Reset only the relevant native prompt key when retesting one feature prompt.
