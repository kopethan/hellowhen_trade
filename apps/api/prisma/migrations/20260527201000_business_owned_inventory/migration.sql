-- Business-owned Needs/Offers need admin review states before they become public.
ALTER TYPE "NeedStatus" ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "NeedStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'rejected';
