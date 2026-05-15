# Data Safety Map

> Documentation note: this map helps prepare privacy labels and data-safety forms. It is not legal advice and must be checked against the final production build and every third-party SDK before launch.

## Account and identity data

Collected or generated:

- email address;
- password hash / auth credentials;
- display name and handle;
- profile bio and avatar;
- country, language, currency, and appearance preferences;
- email verification and security/session timestamps;
- self-declared 18+ age confirmation timestamp and age bucket;
- two-step authentication state if enabled.

Primary purpose:

- account creation and login;
- public profile display;
- localization and account preferences;
- security, abuse prevention, and support.

## Marketplace content

Collected or generated:

- Needs, Offers, Trades;
- titles, descriptions, categories, tags, timing, location labels, and mode;
- proposal messages and trade conversation messages;
- uploaded media and media moderation status.

Primary purpose:

- marketplace discovery;
- user-to-user trade coordination;
- moderation, support, and abuse prevention.

## Safety and support data

Collected or generated:

- reports, report reasons, report details, target content IDs;
- support tickets, ticket messages, and attachments;
- admin notes and audit logs;
- account deletion requests;
- user block records.

Primary purpose:

- user safety;
- support response;
- content moderation;
- account/privacy request handling;
- marketplace integrity.

## Diagnostics and analytics

Current launch expectation:

- do not add analytics, advertising, attribution, crash, or diagnostics SDKs unless the privacy/data-safety forms are updated to match.
- server logs may still contain request metadata needed for security and operations.

## First-launch money data

Money, wallet, payouts, payment-provider accounts, and real-money trade data should not be collected during first launch because those features remain disabled.

Hellowhen also should not collect date of birth, government ID documents, or selfie age checks for normal first-launch signup. The launch gate stores only the 18+ confirmation timestamp and declared age bucket.

If a later launch enables money features, update this map before implementation is released.
