-- Store the viewer's ordered fallback languages for multilingual content.
ALTER TABLE "UserSettings" ADD COLUMN "contentLanguageOrder" JSONB;

UPDATE "UserSettings"
SET "contentLanguageOrder" = '["en"]'::jsonb
WHERE "contentLanguageOrder" IS NULL;
