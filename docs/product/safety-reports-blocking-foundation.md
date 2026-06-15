# SAFETY2 — Reports + blocking foundation

SAFETY2 connects the existing report/block user flows to the provider-neutral moderation foundation from SAFETY1.

## What this phase does

- Keeps the existing `/reports` API and report UI intact.
- Keeps the existing user block APIs intact.
- Requires active, non-restricted accounts for creating reports and changing block state.
- Creates a `ModerationCase` whenever a new user report is created.
- Backfills a moderation case for an unresolved duplicate report if the report predates SAFETY2.
- Links `Report.moderationCaseId` to the created moderation case.
- Records a `ModerationAction` with the reporter as the actor.

## What this phase does not do

- No external moderation provider is called.
- No automatic image/text scan is introduced.
- No admin moderation queue redesign is included.
- No new public report UI is introduced.
- No private message scanning policy is changed.

## Report to moderation mapping

| Report target | Moderation content type | Visibility |
| --- | --- | --- |
| `user` | `user` | `public` |
| `profile` | `profile` | `public` |
| `trade` | `trade` | `public` |
| `need` | `need` | `public` |
| `offer` | `offer` | `public` |
| `proposal` | `proposal` | `reported_private` |
| `message` | `message` | `reported_private` |
| `public_message` | `public_message` | `public` |
| `media` | `media` | `public` |
| `plan` | `plan` | `public` |
| `plan_place` | `plan_place` | `public` |

## Priority rules

SAFETY2 assigns moderation case priority from the report reason:

- `illegal_unsafe`: 90
- `scam`, `impersonation`: 80
- `harassment`: 70
- `inappropriate_image`, `fake_profile`: 60
- `spam`: 40
- `other`: 30

These are queue-priority hints only. They do not remove content automatically.

## Blocking rule

Blocking remains user-controlled and relationship-based. Existing runtime filters and guard checks continue to hide profiles, trade surfaces, saved items, plans, and proposal conversations where a block exists between two users.

SAFETY2 only tightens write access for block changes by requiring an active account. Restricted accounts can still contact support, but they cannot create new reports or change block relationships through these marketplace endpoints.

## Next phase

SAFETY3 should use the moderation case link in the admin review queue so admins can see:

- the original report,
- the linked `ModerationCase`,
- the case action history,
- and later provider results from SAFETY5/SAFETY6.
