-- Business-owned inventory templates need explicit review states.
ALTER TYPE "InventoryTemplateStatus" ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "InventoryTemplateStatus" ADD VALUE IF NOT EXISTS 'rejected';
