-- Allow starter Need/Offer library templates to carry reusable admin-uploaded images.

ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'inventory_template';
