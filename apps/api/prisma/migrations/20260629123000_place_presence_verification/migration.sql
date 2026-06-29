-- CreateEnum
CREATE TYPE "PlaceLocationSource" AS ENUM ('manual', 'google_places');

-- CreateEnum
CREATE TYPE "PlaceAddressValidationStatus" AS ENUM ('confirmed', 'needs_review', 'unsupported');

-- CreateEnum
CREATE TYPE "PlacePresenceVerificationSource" AS ENUM ('device_gps');

-- CreateEnum
CREATE TYPE "PlacePresenceVerificationStatus" AS ENUM ('verified', 'rejected');

-- AlterTable
ALTER TABLE "Place" ADD COLUMN "googlePlaceId" TEXT,
ADD COLUMN "googlePlaceName" TEXT,
ADD COLUMN "formattedAddress" TEXT,
ADD COLUMN "googleMapsUri" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "locationSource" "PlaceLocationSource",
ADD COLUMN "addressValidationStatus" "PlaceAddressValidationStatus";

-- AlterTable
ALTER TABLE "PlanPlace" ADD COLUMN "googlePlaceId" TEXT,
ADD COLUMN "googlePlaceName" TEXT,
ADD COLUMN "formattedAddress" TEXT,
ADD COLUMN "googleMapsUri" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "locationSource" "PlaceLocationSource",
ADD COLUMN "addressValidationStatus" "PlaceAddressValidationStatus";

-- CreateTable
CREATE TABLE "PlacePresenceVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planPlaceId" TEXT NOT NULL,
    "sourcePlaceId" TEXT,
    "source" "PlacePresenceVerificationSource" NOT NULL DEFAULT 'device_gps',
    "status" "PlacePresenceVerificationStatus" NOT NULL,
    "latitudeRounded" DOUBLE PRECISION,
    "longitudeRounded" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "maxDistanceMeters" DOUBLE PRECISION,
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacePresenceVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Place_googlePlaceId_idx" ON "Place"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Place_latitude_longitude_idx" ON "Place"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "PlanPlace_googlePlaceId_idx" ON "PlanPlace"("googlePlaceId");

-- CreateIndex
CREATE INDEX "PlanPlace_latitude_longitude_idx" ON "PlanPlace"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "PlacePresenceVerification_userId_status_verifiedAt_idx" ON "PlacePresenceVerification"("userId", "status", "verifiedAt");

-- CreateIndex
CREATE INDEX "PlacePresenceVerification_planId_planPlaceId_status_verifiedAt_idx" ON "PlacePresenceVerification"("planId", "planPlaceId", "status", "verifiedAt");

-- CreateIndex
CREATE INDEX "PlacePresenceVerification_planPlaceId_userId_status_verifiedAt_idx" ON "PlacePresenceVerification"("planPlaceId", "userId", "status", "verifiedAt");

-- CreateIndex
CREATE INDEX "PlacePresenceVerification_sourcePlaceId_status_verifiedAt_idx" ON "PlacePresenceVerification"("sourcePlaceId", "status", "verifiedAt");

-- CreateIndex
CREATE INDEX "PlacePresenceVerification_createdAt_idx" ON "PlacePresenceVerification"("createdAt");

-- AddForeignKey
ALTER TABLE "PlacePresenceVerification" ADD CONSTRAINT "PlacePresenceVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacePresenceVerification" ADD CONSTRAINT "PlacePresenceVerification_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacePresenceVerification" ADD CONSTRAINT "PlacePresenceVerification_planPlaceId_fkey" FOREIGN KEY ("planPlaceId") REFERENCES "PlanPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacePresenceVerification" ADD CONSTRAINT "PlacePresenceVerification_sourcePlaceId_fkey" FOREIGN KEY ("sourcePlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
