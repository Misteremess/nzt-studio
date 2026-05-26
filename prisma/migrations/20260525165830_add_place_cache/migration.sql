-- CreateTable
CREATE TABLE "place_cache" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'google_places',
    "name" TEXT NOT NULL,
    "formattedAddress" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "types" TEXT[],
    "primaryType" TEXT,
    "businessStatus" TEXT,
    "rating" DOUBLE PRECISION,
    "userRatingCount" INTEGER,
    "websiteUri" TEXT,
    "nationalPhone" TEXT,
    "internationalPhone" TEXT,
    "googleMapsUri" TEXT,
    "hasOpeningHours" BOOLEAN NOT NULL DEFAULT false,
    "openingHoursDescriptions" TEXT[],
    "signals" JSONB,
    "opportunities" JSONB,
    "rawSearch" JSONB,
    "rawDetail" JSONB,
    "searchFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detailFetchedAt" TIMESTAMP(3),
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "place_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "place_cache_placeId_key" ON "place_cache"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "place_cache_companyId_key" ON "place_cache"("companyId");

-- CreateIndex
CREATE INDEX "place_cache_latitude_longitude_idx" ON "place_cache"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "place_cache_searchFetchedAt_idx" ON "place_cache"("searchFetchedAt");

-- AddForeignKey
ALTER TABLE "place_cache" ADD CONSTRAINT "place_cache_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
