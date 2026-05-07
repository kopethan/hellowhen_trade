# Patch 5 — Media Uploads + Basic Admin Review

Patch 5 adds development image upload support for Needs, Offers, and Trades while keeping Hellowhen trade-first and fake-credit-only.

## Included

- Reusable `MediaAsset` Prisma model.
- Local development upload storage served from `/uploads`.
- `POST /media/image` for authenticated JPEG/PNG/WEBP uploads, max 5 MB.
- `DELETE /media/:mediaId` soft-removes a user-owned image.
- `mediaIds` support on create Need, Offer, and Trade requests.
- Media returned on `GET /needs/mine`, `GET /offers/mine`, `GET /trades/feed`, `GET /trades/mine`, and `GET /trades/:tradeId`.
- Mobile image picker and preview for Create Need, Create Offer, and Create Trade.
- Mobile image rendering in Needs, Offers, Trade Deck cards, and Trade Detail.
- Basic admin media review API under `/admin/media`.
- Basic web admin page at `/admin/media`.
- Seed admin account: `admin@hellowhen.app / password123`.

## Not included

- No video upload.
- No chat attachments.
- No AI moderation.
- No S3/R2/Cloudinary/CDN yet.
- No full production admin dashboard.
- No real Stripe, payouts, or money movement.

## Local setup notes

Add to `.env` if needed:

```env
UPLOAD_DIR=./uploads
NEXT_PUBLIC_API_URL=http://localhost:4000
```

After applying the patch, run:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:validate
npm run typecheck
```
