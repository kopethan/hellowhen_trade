-- Phase 12: optional wallet money alongside legacy credits.
-- Existing credit columns are kept for compatibility, but new mobile/API paths use amountCents + currency.

ALTER TABLE "Trade"
  ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'eur',
  ALTER COLUMN "creditAmount" SET DEFAULT 0;

ALTER TABLE "Wallet"
  ADD COLUMN "availableBalanceCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "heldBalanceCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pendingPayoutCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'eur';

ALTER TABLE "CreditLedgerEntry"
  ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'eur';

ALTER TABLE "TradePayment"
  ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'eur',
  ADD COLUMN "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "creditAmount" SET DEFAULT 0;

ALTER TABLE "TradeEscrow"
  ADD COLUMN "heldAmountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'eur',
  ALTER COLUMN "heldCredits" SET DEFAULT 0;

ALTER TABLE "PayoutRequest"
  ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'eur';

CREATE INDEX "Trade_amountCents_idx" ON "Trade"("amountCents");
