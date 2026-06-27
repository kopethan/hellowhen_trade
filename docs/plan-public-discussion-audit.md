# PLAN-THREAD1 — Plan public discussion audit

## Goal

Add a public comment/discussion area to Plan details, copying the existing Trade public discussion behavior where possible.

This audit intentionally does **not** add the Plan thread feature yet. It maps the current Trade system and defines the safest next patch path.

## Product scope

For the first Plan discussion version:

- Add **public** Plan comments only.
- Do **not** add private Plan threads, join-request chat, proposal chat, or deal chat.
- Logged-in members can read and post public comments on visible Plans.
- Plan owner participates like any other member.
- Users can edit/delete their own public messages.
- Users can report the Plan discussion or individual public messages.
- Admin/moderation should be able to hide/restore public messages.

## Existing Trade public discussion system

The Trade side already has a complete public discussion implementation.

### Backend/API

Current Trade endpoints live in `apps/api/src/modules/trades/trades.routes.ts`:

- `GET /trades/:tradeId/public-messages`
- `POST /trades/:tradeId/public-messages`
- `PATCH /trades/:tradeId/public-messages/:messageId`
- `DELETE /trades/:tradeId/public-messages/:messageId`

Important existing behavior:

- Reading requires auth.
- Writing requires auth and an active account.
- Read access uses `loadReadableTradeForDiscussion()`.
- Write access uses `canWritePublicDiscussion()` and is only open while the Trade is active/public.
- Blocked owner/viewer pairs are blocked from reading.
- Restricted authors are filtered from returned messages.
- Messages support `visible`, `hidden`, and `deleted` status.
- User delete is soft delete: body cleared, status set to `deleted`.
- Admin/moderation hide uses `hidden`.
- AI text review already runs for public messages with `contentType: 'public_message'`.

### Database

Current model in `apps/api/prisma/schema.prisma`:

- `TradePublicMessage`
- `TradePublicMessageStatus`

Important columns:

- `tradeId`
- `authorId`
- `body`
- `status`
- `editedAt`
- `editCount`
- `deletedAt`
- `hiddenAt`
- `hiddenById`
- `moderationNote`

Indexes already match the needed read/write shape:

- `[tradeId, status, createdAt]`
- `[authorId, createdAt]`
- `[hiddenById, hiddenAt]`

### Contracts

Current public message contracts live in `packages/contracts/src/trade.ts`:

- `createTradePublicMessageRequestSchema`
- `updateTradePublicMessageRequestSchema`
- `listTradePublicMessagesQuerySchema`
- `tradePublicMessageSchema`
- `tradePublicMessagesResponseSchema`
- `tradePublicMessageResponseSchema`

The request and response shape is reusable for Plan messages.

### API client

Current client methods live in `packages/api-client/src/index.ts` under `api.trades`:

- `publicMessages(tradeId, query)`
- `sendPublicMessage(tradeId, body)`
- `updatePublicMessage(tradeId, messageId, body)`
- `deletePublicMessage(tradeId, messageId)`

Plan should get matching methods under `api.plans`.

### Web UI

Current web client:

- `apps/web/src/features/trade/TradePublicDiscussionClient.tsx`
- route: `apps/web/src/app/trades/[tradeId]/discussion/page.tsx`

Useful reusable UI behavior:

- message loading/merge helpers
- send composer
- edit own message
- delete own message
- report other message
- menu/guide/report views
- signed-out fallback
- messages-only page layout

For Plan, copy the interaction pattern but simplify the guide copy because there is no private Plan thread yet.

### Mobile UI

Current native screen:

- `apps/mobile/src/features/trade/TradePublicDiscussionScreen.tsx`
- stack route: `TradePublicDiscussion`
- protected route in `RootNavigator.tsx`

Useful reusable UI behavior:

- date separators
- message rows
- own-message menu
- edit/delete
- report panel
- bottom composer

Plan should get a dedicated `PlanPublicDiscussion` screen first. A shared generic mobile discussion component can come later if both screens stabilize.

## Plan-specific access rules

Use existing Plan visibility semantics from `apps/api/src/modules/plans/plans.routes.ts`:

- Visible public statuses: `open`, `full`, `started`.
- Owner can see their Plan even outside public statuses.
- Non-owner cannot see hidden/cancelled/expired/draft Plans.
- Restricted owners should not expose public Plans.
- Blocked owner/viewer pairs should not read or write Plan discussion.

Recommended read rule:

```txt
A logged-in member can read public Plan comments if they can load the Plan through the same public/owner visibility rules as Plan detail.
```

Recommended write rule:

```txt
A logged-in active member can post only when Plan status is open/full/started.
```

Do not require the commenter to have joined the Plan in v1. Public comments should support questions before joining.

## Database recommendation

Use a dedicated `PlanPublicMessage` model for the first implementation.

Why not immediately generalize `TradePublicMessage` into a generic `PublicDiscussionMessage` table:

- It would require migrating the existing Trade table and touching reports, moderation, admin, web, mobile, API client, and contracts at once.
- The current Trade system is already working.
- A generic model is cleaner long term but higher risk for this patch chain.

Recommended v1 model:

```prisma
model PlanPublicMessage {
  id             String                   @id @default(cuid())
  planId         String
  authorId       String
  body           String
  status         TradePublicMessageStatus @default(visible)
  editedAt       DateTime?
  editCount      Int                      @default(0)
  deletedAt      DateTime?
  hiddenAt       DateTime?
  hiddenById     String?
  moderationNote String?
  createdAt      DateTime                 @default(now())
  updatedAt      DateTime                 @updatedAt

  plan     Plan  @relation(fields: [planId], references: [id], onDelete: Cascade)
  author   User  @relation("AuthoredPlanPublicMessages", fields: [authorId], references: [id], onDelete: Cascade)
  hiddenBy User? @relation("HiddenPlanPublicMessages", fields: [hiddenById], references: [id], onDelete: SetNull)

  @@index([planId, status, createdAt])
  @@index([authorId, createdAt])
  @@index([hiddenById, hiddenAt])
}
```

It can reuse `TradePublicMessageStatus` for now to avoid adding another identical enum.

Long-term cleanup can later introduce:

```txt
PublicDiscussionMessage
  targetType: trade | plan
  targetId
```

and migrate both Trade and Plan into it.

## Moderation/report risks

The existing report target type `public_message` currently resolves only `TradePublicMessage`.

For Plan v1, `public_message` should resolve both tables:

1. Look up `TradePublicMessage`.
2. If not found, look up `PlanPublicMessage`.
3. Return the correct URL:
   - Trade: `/trades/:tradeId/discussion`
   - Plan: `/plans/:planId/discussion`

The same dual-table lookup/update is needed in:

- reports target summary
- admin hide/restore action
- moderation text enforcement for `contentType: 'public_message'`

This avoids adding a new public report target type and keeps UI copy simple: **Report public message**.

## Reuse strategy

### Reuse directly

- Message body validation: trim/min/max 2000 chars.
- Query validation: `take`, `before`.
- Message status values: `visible`, `hidden`, `deleted`.
- Soft-delete behavior.
- AI text review content type: `public_message`.
- Report target type: `public_message`.
- Web/mobile message row behavior.

### Copy then adapt

- API route handlers from Trade to Plan.
- Web `TradePublicDiscussionClient` into `PlanPublicDiscussionClient`.
- Mobile `TradePublicDiscussionScreen` into `PlanPublicDiscussionScreen`.

Copying first is safer than extracting a shared generic component immediately because Trade and Plan copy/content/status rules still differ.

### Do not reuse yet

- Private proposal threads.
- Proposal/deal status actions.
- Trade-specific guide copy about private proposals.
- Trade `isPublic` write rule; Plan uses status visibility instead.

## Recommended implementation patches

### PLAN-THREAD2 — Plan public discussion backend/contracts

Scope:

- Add `PlanPublicMessage` Prisma model and migration.
- Add Plan public message contracts in `packages/contracts/src/plans.ts`.
- Add API client methods under `api.plans`.
- Add `/plans/:planId/public-messages` routes:
  - GET
  - POST
  - PATCH
  - DELETE
- Extend reports/moderation/admin public message handling to support both Trade and Plan public messages.

### PLAN-THREAD3 — Mobile Plan public discussion

Scope:

- Add `PlanPublicDiscussionScreen`.
- Add protected stack route.
- Add Plan detail row/button: `Public discussion`.
- Show count if cheap; otherwise omit count in first pass.
- Support message send/edit/delete/report.

### PLAN-THREAD4 — Web Plan public discussion parity

Scope:

- Add `/plans/[planId]/discussion` route.
- Add `PlanPublicDiscussionClient`.
- Add Plan detail row/button: `Public discussion`.
- Support message send/edit/delete/report.
- Use a compact messages-only shell similar to Trade.

### PLAN-THREAD5 — Public discussion polish

Scope:

- Align empty states and labels across Trade/Plan.
- Add optional message counts to Plan detail if performance is acceptable.
- Add smoke test docs for mobile/web/API.
- Consider extracting shared public discussion UI after both systems are stable.

## Decision

For the next implementation patch, use:

```txt
Go PLAN-THREAD2 — Plan public discussion backend/contracts
```

Do not start with private Plan threads yet.
