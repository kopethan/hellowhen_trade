# APPSTORE26-UGC1 — Mobile UGC safety review checklist

Use this checklist on the exact production API and mobile build prepared for App Store review. It verifies the user-generated-content controls expected for Hellowhen profiles, Trades, Plans, Places, public discussions, private proposals, media, and support.

## Test setup

Prepare three accounts:

- **Reviewer account:** normal verified member used in App Store Connect review notes.
- **Second member:** owns reportable Trades, Plans, Places, public messages, and a private proposal thread with the reviewer account.
- **Admin operator:** separate admin account used only to verify the moderation queue and actions.

The reviewer account should have:

- one public Trade owned by the second member;
- one public Plan with at least one offline Place owned by the second member;
- one public Trade discussion message from the second member;
- one public Plan discussion message from the second member;
- one private proposal/message exchange with the second member;
- no admin role or hidden feature access.

## Report privacy

For every report below, confirm that:

- the reporter sees a success state without private admin information;
- the reported member does not receive the reporter's details or report text;
- notifications do not expose report details, private message text, or admin notes;
- the report appears in **Me → Safety center → Your reports** with only its target label, reason, date, and public status;
- the report reaches the admin moderation queue with the linked target and moderation case.

Test these report surfaces:

1. Trade Detail → report a non-owned Trade.
2. Public profile → report the second member.
3. Trade public discussion → report one public message.
4. Plan Detail → report a non-owned Plan.
5. Plan Place detail → report a Place inside the Plan.
6. Plan public discussion → report one public message.
7. Private proposal thread → report the proposal/thread.
8. Private proposal thread → report one private message.
9. Accepted-deal workspace → report a problem and confirm the linked report/support context is created.

Do not test by reporting content owned by the same account; self-reporting should be rejected.

## Block and unblock

1. Open the second member's public profile.
2. Block the member.
3. Confirm the profile reflects the blocked state.
4. Confirm normal Hellowhen interaction paths with that member are unavailable or filtered according to the existing block rules.
5. Open **Me → Safety center**.
6. Confirm the member appears under **Blocked members** without email, trust internals, or other private account fields.
7. Tap **Unblock**.
8. Refresh the Safety center and public profile.
9. Confirm the member is no longer listed and normal eligible interactions are restored.

## Safety center

Verify on iPhone and iPad compatibility mode:

- **Me → Settings & safety → Safety center** is reachable after login.
- Pull-to-refresh reloads reports and blocked members.
- Empty states are clear when no reports or blocks exist.
- Safety Guidelines open from the screen.
- Contact Support opens from the screen.
- Report statuses render for `pending`, `reviewing`, `resolved`, and `dismissed` without exposing resolution notes.
- Unblock has loading, success, and error states.
- English and French layouts do not truncate primary actions.

## Support and policy access

Verify:

- Support Center can create a `safety_concern` ticket.
- The user can attach selected screenshots.
- Support Center links to Safety center, Safety Guidelines, and Refund & Dispute Policy.
- Safety center links back to Support.
- Terms, Privacy, Safety Guidelines, and Refund & Dispute Policy are reachable in the submitted build.
- Public support/contact URLs used in App Store Connect are live.

## Admin moderation queue

Using the admin operator account, verify each test report:

- appears in `/admin/reports`;
- includes the correct target type and target link;
- has a linked moderation case;
- can be marked reviewing;
- can be resolved or dismissed with an audit note;
- can hide and restore supported public targets;
- can suspend and unsuspend the target owner when appropriate;
- can escalate to a support ticket;
- does not expose unrelated private data to the mobile reporter.

Also confirm moderation and support actions are recorded in the existing admin audit trail.

## Content filtering

Create harmless test text that exercises the moderation pipeline for:

- Need creation/update;
- Offer creation/update;
- Trade creation and public discussion;
- Plan public discussion.

Confirm blocked content follows the current moderation outcome instead of silently publishing. Do not use real illegal, exploitative, or personally identifying content in production tests.

## Account deletion

From the reviewer account:

1. Open **Me → Settings & safety → Delete account**.
2. Confirm the screen explains possible retention of report, moderation, support, legal, and abuse-prevention records.
3. Create a deletion request.
4. Confirm it creates the private support/deletion record.
5. Cancel the request before final processing.
6. Confirm Support remains reachable for account or safety questions.

## Reviewer account sign-off

Before submission, record:

- production commit SHA;
- iOS marketing version and build number;
- reviewer and second-member account emails stored in the private release record;
- exact Trade, Plan, Place, public-message, and proposal IDs used for review;
- result of `npm run mobile:ugc-safety-smoke`;
- result of `npm run mobile:store-readiness`;
- device models, iOS versions, language, and appearance tested;
- admin operator who verified the moderation queue;
- any unresolved safety issue and whether it blocks submission.

Do not put admin credentials, private report text, or reusable production passwords in App Store review notes or this repository.
