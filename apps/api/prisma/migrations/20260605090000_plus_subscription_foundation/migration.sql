-- Add the hidden lightweight Plus tier without removing the legacy plus_later placeholder.
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'plus' AFTER 'free';
