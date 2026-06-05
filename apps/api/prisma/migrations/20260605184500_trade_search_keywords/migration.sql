-- Store privacy-safe aggregate trade search keywords for autocomplete suggestions.
CREATE TABLE "TradeSearchKeyword" (
  "id" TEXT NOT NULL,
  "normalizedQuery" TEXT NOT NULL,
  "displayQuery" TEXT NOT NULL,
  "language" TEXT,
  "countryCode" TEXT,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "successfulCount" INTEGER NOT NULL DEFAULT 0,
  "suggestionClickCount" INTEGER NOT NULL DEFAULT 0,
  "lastResultCount" INTEGER NOT NULL DEFAULT 0,
  "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TradeSearchKeyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradeSearchKeyword_normalizedQuery_key" ON "TradeSearchKeyword"("normalizedQuery");
CREATE INDEX "TradeSearchKeyword_totalCount_lastSearchedAt_idx" ON "TradeSearchKeyword"("totalCount", "lastSearchedAt");
CREATE INDEX "TradeSearchKeyword_successfulCount_lastSearchedAt_idx" ON "TradeSearchKeyword"("successfulCount", "lastSearchedAt");
CREATE INDEX "TradeSearchKeyword_language_countryCode_lastSearchedAt_idx" ON "TradeSearchKeyword"("language", "countryCode", "lastSearchedAt");
