# Phase 23.7 — device/browser language QA and French copy polish

## Scope

This pass continues the i18n work from Phase 23.6 without changing routes, app visuals, feed/deck behavior, proposal logic, wallet/money logic, or public profile behavior.

The goal was to run practical browser/native checks where the sandbox allows it, polish French product copy, and fix remaining safe runtime-visible labels.

## Runtime-visible fixes made

- Localized the web and native beta badge through `common.states.beta`.
- Localized wallet/payout money-safety messages on web and native instead of rendering backend English text directly.
- Localized payout status labels in web payout history and native payout history.
- Localized native business profile type/status labels.
- Localized the native `Stripe demo` badge through the shared dictionary.
- Localized the web Add Money currency selector helper text.
- Polished French copy from “support” to “assistance” in user-facing surfaces.
- Polished French business/account copy from “business” to “professionnel” where it is user-facing.
- Kept provider/brand/product names unchanged where appropriate: Hellowhen, Stripe, Stripe Connect, Airwallex, KYB.

## Browser QA performed in sandbox

### Next.js dev session

Command:

```bash
npm run dev -w @hellowhen/web
```

Result:

- Next.js dev server started successfully.
- `/account/settings` returned `200 OK`.
- `/account/wallet` redirected to `/account` when wallet features were not visible, which matches the current beta feature flags.

Notes:

- Server-rendered HTML still starts in English when there is no server-side language cookie or route locale. The client i18n provider resolves browser/localStorage language after hydration. Avoiding all initial English SSR copy would require a cookie-backed language preference or route-based locale, which is intentionally out of scope for the current preference-based implementation.

### Next.js build

Command:

```bash
NEXT_TELEMETRY_DISABLED=1 NEXT_BUILD_WORKER_COUNT=1 npm run build -w @hellowhen/web
```

Result:

- Production build compiled successfully.
- Web TypeScript finished successfully during the build.
- The sandbox command timed out during Next.js static page-data collection, after compile/typecheck had completed. Re-run locally to confirm full build exit.

## Native/Expo QA performed in sandbox

### Expo config validation

Command:

```bash
npx expo config --type public --json
```

Result:

- Expo config resolved successfully.
- SDK reported as `51.0.0`.
- Platforms reported as `ios` and `android`.

### Expo start attempt

Command:

```bash
npm run start -w @hellowhen/mobile -- --non-interactive
```

Result:

- Metro startup was attempted.
- Expo then failed on network access to `api.expo.dev` with `EAI_AGAIN` while fetching SDK native module metadata.
- This is an environment/network limitation, not an app type/syntax failure.

## Static validation performed

- `npm run typecheck -w @hellowhen/i18n` passed.
- `npm run typecheck -w @hellowhen/web` passed.
- `npm run typecheck -w @hellowhen/mobile` passed.
- English/French dictionary parity passed with `1275` keys.
- Targeted TS/TSX syntax transpile checks passed for changed files.
- Non-admin hardcoded-label audit only found intentional names/placeholders:
  - `Hellowhen`
  - `Kopy` placeholder

## Full workspace typecheck note

`npm run typecheck` is still blocked at the API workspace until Prisma Client is generated. Prisma generation could not complete in the sandbox because downloading Prisma engine binaries from `binaries.prisma.sh` failed with `EAI_AGAIN`.

## Manual real-device/browser QA checklist

### Web browser

1. Open `/account/settings` in Chrome/Firefox/Safari.
2. Set language to `Français`.
3. Refresh the page and confirm settings/account labels are French after hydration.
4. Set language to `English` and confirm labels switch back.
5. Set language to `System default`, change browser preferred language to French, and confirm app labels resolve to French.
6. Confirm public route paths remain unchanged, including `/users/[userId]`.
7. Confirm trade titles, descriptions, bios, support messages, proposal messages, and conversation messages are not translated.

### Expo Go / native runtime

1. Open the app with device language set to English.
2. Confirm tabs and Account/Settings labels are English.
3. Change app language to French in Settings and confirm tabs/account/wallet/support labels switch to French.
4. Restart Expo Go and confirm the saved language remains selected.
5. Set app language to System default, change the device language to French, then reload the app and confirm French labels.
6. Confirm native proposal messages, trade titles, descriptions, bios, and support ticket bodies stay as user-written content.
7. Confirm payout/wallet hidden states still respect current beta feature flags.
