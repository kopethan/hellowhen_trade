# Privacy & Data Readiness Checklist

> Documentation note: this checklist is operational readiness guidance, not legal advice and must be reviewed with counsel before public launch.

## Data inventory

- Account and session data mapped.
- 18+ self-declared age confirmation timestamp and bucket mapped; no date of birth or ID document collection added for first launch.
- Public profile fields mapped.
- Need/Offer/Trade public visibility mapped.
- Proposal/message visibility mapped.
- Support ticket and attachment visibility mapped.
- Report and moderation data mapped.
- Admin audit log data mapped.
- Upload storage and media status behavior mapped.

## Launch checks

- Privacy copy matches implemented behavior.
- Language and appearance settings are persisted intentionally.
- Optional-auth public reads can fall back to anonymous access.
- Restricted-session revocation is checked by authenticated API middleware.
- Support/report/admin notes are not exposed through public discovery routes.
- Store privacy disclosures match app behavior.
- A process exists for user privacy/support requests.
- Account deletion request flow is reachable in-app and on web.
- Block records and deletion requests are included in the data-safety inventory.
- Any new analytics, crash, ads, or attribution SDKs are added to the data-safety map before release.
