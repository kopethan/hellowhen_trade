# Patch 4 - Proposal conversations and accept flow

Patch 4 keeps Hellowhen trade-first and fake-credit only.

## Added

- Trade proposals/applications with private proposal conversations.
- Proposal messages scoped to a proposal thread only, not global chat.
- Trade roles: owner/requester and accepted provider/helper.
- Owner can accept/decline proposals.
- Applicant can withdraw proposals.
- Accepting a proposal moves the trade to `in_progress`, sets `providerId`, hides it from the public feed, and holds owner fake credits.
- Completing a trade releases held fake credits into provider pending earned credits.
- Cancelling refunds held fake credits to the owner.
- Demo seed now creates two users:
  - `demo@hellowhen.app` / `password123`
  - `helper@hellowhen.app` / `password123`
- Seed also creates a sample public trade and a pending helper proposal thread.

## API added

- `POST /trades/:tradeId/proposals`
- `GET /trades/:tradeId/proposals`
- `GET /proposals/mine`
- `GET /proposals/:proposalId`
- `PATCH /proposals/:proposalId/status`
- `GET /proposals/:proposalId/messages`
- `POST /proposals/:proposalId/messages`

## Mobile added

- `CreateProposalScreen`
- `ProposalDetailScreen`
- Role-aware `TradeDetailScreen`
- Proposal list/thread entry points inside Trade Detail

## Not added

- No real Stripe.
- No real payouts.
- No full global chat/inbox.
- No notifications.
- No old Hellowhen Plans/action bar/place-feed complexity.
