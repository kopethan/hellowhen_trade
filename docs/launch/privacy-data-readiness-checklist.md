# Privacy & Data Readiness Checklist

> Documentation note: this checklist is operational readiness guidance, not legal advice and must be reviewed with counsel before public launch.

## Data inventory

- Account and session data mapped.
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
