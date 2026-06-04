-- Add an explicit notification type for withdrawn proposals.
ALTER TYPE "InAppNotificationType" ADD VALUE IF NOT EXISTS 'trade_proposal_withdrawn';
