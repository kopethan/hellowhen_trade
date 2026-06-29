-- Add indexes for place presence anti-cheat rate checks.
CREATE INDEX "PlacePresenceVerification_userId_createdAt_idx" ON "PlacePresenceVerification"("userId", "createdAt");
CREATE INDEX "PlacePresenceVerification_userId_status_createdAt_idx" ON "PlacePresenceVerification"("userId", "status", "createdAt");
