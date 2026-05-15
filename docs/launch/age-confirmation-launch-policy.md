# Age Confirmation Launch Policy

> Documentation note: this is launch-readiness guidance, not legal advice. Final policy wording and store declarations must be reviewed before public launch.

## First-launch position

Hellowhen Trade is 18+ for the first launch.

- Users must confirm they are 18 or older during registration.
- Teen/minor accounts are not supported for the first launch.
- The app is not directed to children.
- The age check is self-declared confirmation, not government ID verification.
- Hellowhen does not collect date of birth, ID documents, or selfie age checks for normal signup.
- Money, wallet, payouts, payment-provider onboarding, and real-money trades remain disabled.

## Product implementation

Registration requires:

- Terms and Privacy acceptance;
- `ageConfirmed: true`;
- `declaredAgeBucket: "18_plus"`.

Stored account metadata:

- `ageConfirmedAt` timestamp;
- `declaredAgeBucket = "18_plus"`.

The product should call this **age confirmation**, not **age verification**, because no paid verification provider or identity document check is used.

## Store review notes

When preparing Apple/Google review notes, explain:

- Hellowhen is an adult 18+ service/goods/skill trade marketplace.
- The app is not designed for children or teens.
- Users self-confirm they are 18+ at signup.
- UGC safety is supported by reports, blocking, support contact, admin moderation, hidden-content filtering, restricted-user controls, and account deletion request flows.

## Future teen mode non-goal

Do not add teen accounts, parental consent, date-of-birth storage, ID checks, or minor-specific UX in this launch-readiness scope. Treat teen mode as a separate safety/legal/product project if it is considered later.
