-- Move language preference from implicit English default to explicit system/browser/device fallback.
UPDATE "UserSettings"
SET "language" = 'system'
WHERE "language" IS NULL OR "language" = 'en' OR "language" NOT IN ('system', 'en', 'fr');

ALTER TABLE "UserSettings" ALTER COLUMN "language" SET DEFAULT 'system';
