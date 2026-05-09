-- Money launch safety acknowledgements.
CREATE TABLE "MoneyPolicyAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "walletTermsVersion" TEXT NOT NULL,
    "payoutTermsVersion" TEXT NOT NULL,
    "refundPolicyVersion" TEXT NOT NULL,
    "disputePolicyVersion" TEXT NOT NULL,
    "launchMode" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyPolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MoneyPolicyAcknowledgement_userId_policyVersion_key" ON "MoneyPolicyAcknowledgement"("userId", "policyVersion");
CREATE INDEX "MoneyPolicyAcknowledgement_userId_acknowledgedAt_idx" ON "MoneyPolicyAcknowledgement"("userId", "acknowledgedAt");
CREATE INDEX "MoneyPolicyAcknowledgement_policyVersion_acknowledgedAt_idx" ON "MoneyPolicyAcknowledgement"("policyVersion", "acknowledgedAt");

ALTER TABLE "MoneyPolicyAcknowledgement" ADD CONSTRAINT "MoneyPolicyAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
