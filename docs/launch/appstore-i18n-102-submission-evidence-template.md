# Hellowhen 1.0.2 private App Store release evidence template

Copy this file to `.release-private/appstore-i18n-102-submission-evidence.md` before filling it in. Never commit the completed copy.

## Release identity

| Field | Value |
| --- | --- |
| Marketing version | 1.0.2 |
| iOS build number | 28 or greater |
| EAS build ID | <EAS_BUILD_ID> |
| Commit SHA | <COMMIT_SHA> |
| App Store Connect app ID | 6781399122 |
| API | https://api.hellowhen.com |
| Public web | https://www.hellowhen.com |
| TestFlight processing complete | <YES_OR_NO> |
| Exact build selected in App Store Connect | <YES_OR_NO> |
| Production update policy disabled for first 1.0.2 rollout | <YES_OR_NO> |

## Exact TestFlight device checks

| Check | Device / OS | Result | Notes |
| --- | --- | --- | --- |
| French system language | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| English system language | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| Spanish system language | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| Unsupported system language → French fallback | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| Saved explicit language persists after restart/update | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| iPhone core reviewer journey | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| iPad compatibility presentation | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| No Beta/prototype presentation | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| Apple Maps first + Google Maps optional | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |
| UGC safety/report/block/support | <DEVICE_AND_OS> | <PASS_OR_FAIL> | <NOTES> |

## Native localization metadata

Record the inspected production-binary result:

```txt
CFBundleDevelopmentRegion: <VALUE>
CFBundleLocalizations: <VALUES>
```

Expected:

```txt
CFBundleDevelopmentRegion: fr
CFBundleLocalizations: fr, en, es
```

## Static release checks

| Command | Result |
| --- | --- |
| npm run mobile:release-preflight | <PASS_OR_FAIL> |
| npm run mobile:submission-preflight | <PASS_OR_FAIL> |
| npm run mobile:store-readiness | <PASS_OR_FAIL> |
| npm run typecheck | <PASS_OR_FAIL> |
| npm run build | <PASS_OR_FAIL> |

## App Store localization handoff

Complete after RELEASE-METADATA1:

| Item | Result / reference |
| --- | --- |
| Existing French localization preserved | <YES_OR_NO> |
| App Store Primary Language verified / decision recorded | <RESULT> |
| English (U.S.) localization added | <YES_OR_NO> |
| English metadata copied from `appstore-i18n-102-en-US-metadata.json` | <YES_OR_NO> |
| English screenshots uploaded and checked against French scenes | <YES_OR_NO> |
| What's New for 1.0.2 copied from approved metadata source | <YES_OR_NO> |
| App Review Notes copied from approved metadata source | <YES_OR_NO> |
| Shared production URLs verified | <YES_OR_NO> |
| Disabled features absent from copy/screenshots | <YES_OR_NO> |

## Reviewer account

Store actual credentials only in this ignored private copy.

```txt
Reviewer email: <REVIEWER_EMAIL>
Temporary password: <TEMPORARY_PASSWORD>
Prepared Plan/trade context: <REVIEW_CONTEXT>
```

## Final decision

```txt
Exact tested build selected: <YES_OR_NO>
RELEASE-METADATA1 metadata/review package complete: <YES_OR_NO>
Ready to submit 1.0.2 for App Review: <YES_OR_NO>
Blockers: <NONE_OR_LIST>
```
