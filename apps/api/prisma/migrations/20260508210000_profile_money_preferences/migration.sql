-- Add profile-level money preferences introduced in phase 18.4.
-- Existing profiles keep a null country until the user chooses one; currency defaults to EUR.
ALTER TABLE "Profile" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "Profile" ADD COLUMN "preferredCurrency" TEXT DEFAULT 'eur';
