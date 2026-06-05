-- PLUS4A: controlled preview card theme foundation.
CREATE TYPE "PreviewCardTheme" AS ENUM ('default', 'blue', 'green', 'purple', 'amber', 'rose');

ALTER TABLE "Need" ADD COLUMN "previewTheme" "PreviewCardTheme" NOT NULL DEFAULT 'default';
ALTER TABLE "Offer" ADD COLUMN "previewTheme" "PreviewCardTheme" NOT NULL DEFAULT 'default';
ALTER TABLE "Trade" ADD COLUMN "previewTheme" "PreviewCardTheme" NOT NULL DEFAULT 'default';
