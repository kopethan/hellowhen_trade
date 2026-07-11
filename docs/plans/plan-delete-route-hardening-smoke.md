# PLAN-DELETE2 deleted Plan route hardening smoke checks

Run these checks after applying `PLAN-DELETE2` with Plans enabled.

## Expected access behavior

A deleted Plan is a terminal public state:

- Public feed, search, detail, and discussion reads return `404 not_found`.
- Unrelated authenticated users also receive `404 not_found` and cannot infer that the Plan was deleted.
- The owner or a former participant receives `410 plan_deleted` when a stale authenticated mutation is attempted.
- Admin Plan history remains available through existing admin-only routes.

## Manual flow

1. Create a Plan as user A.
2. Join it as user B.
3. Keep its detail and discussion screens open for both users.
4. Delete the Plan as user A.
5. Refresh the public feed and confirm the Plan is absent.
6. Open `/plans/<planId>` while logged out and confirm the API-backed screen reports not found.
7. Open `/plans/<planId>/discussion` while logged out and confirm no comments are returned.
8. From stale authenticated screens, confirm these operations fail without changing data:
   - join or request to join;
   - leave or cancel a join request;
   - accept, decline, or remove a participant;
   - add, update, or delete a stop;
   - verify presence;
   - create, edit, or delete a public discussion message;
   - update, cancel, or delete the Plan again.
9. Confirm web and native Share actions re-check the Plan and do not open the share sheet for the deleted route.
10. Confirm reporting the deleted Plan, one of its stops, or one of its discussion comments returns `404 target_not_found`.

## Data integrity checks

- The Plan remains soft-deleted with `deletedAt` populated and `status = hidden`.
- Capacity synchronization does not change a deleted Plan back to `open` or `full`.
- Existing participant, message, verification, and moderation history remains available to administrators.
- Cancelled but non-deleted Plans remain readable and shareable, while their active interactions stay locked by `PLAN-CANCEL1`.
