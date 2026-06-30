// features/analyzer/lib/place-cache.ts
// Server-only Prisma helpers for reading and writing PlaceCache records.
//
// Responsibility: persistence only. No API calls, no business logic.
// The orchestration (check cache → call API if stale → update cache) lives in
// the Server Actions (NZT-79).
import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { computeScore } from "@/features/rastreador/lib/score";
import { haversineDistance } from "@/features/rastreador/lib/distance";
import type {
  PlaceSummary,
  PlaceDetail,
  PlaceLocation,
  PlaceBusinessStatus,
  DetectedOpportunity,
} from "@/features/rastreador/types";

// ─── Select shape ──────────────────────────────────────────────────────────────

// Consistent column selection used across all reads.
// Update here if PlaceCache schema changes.
const SELECT = {
  id: true,
  placeId: true,
  source: true,
  name: true,
  formattedAddress: true,
  latitude: true,
  longitude: true,
  types: true,
  primaryType: true,
  businessStatus: true,
  rating: true,
  userRatingCount: true,
  websiteUri: true,
  nationalPhone: true,
  internationalPhone: true,
  googleMapsUri: true,
  hasOpeningHours: true,
  openingHoursDescriptions: true,
  signals: true,
  opportunities: true,
  webAudit: true,
  webAuditFetchedAt: true,
  searchFetchedAt: true,
  detailFetchedAt: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlaceCacheSelect;

export type PlaceCacheRow = Prisma.PlaceCacheGetPayload<{
  select: typeof SELECT;
}>;

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Looks up a cached place by its Google Places ID.
 * Returns null if not found.
 */
export async function getPlaceCacheByPlaceId(
  placeId: string
): Promise<PlaceCacheRow | null> {
  return prisma.placeCache.findUnique({
    where: { placeId },
    select: SELECT,
  });
}

/**
 * Returns all PlaceCache records linked to a specific Company.
 * Normally at most one record per Company (enforced by @unique on companyId).
 */
export async function getPlaceCacheByCompanyId(
  companyId: string
): Promise<PlaceCacheRow | null> {
  return prisma.placeCache.findUnique({
    where: { companyId },
    select: SELECT,
  });
}

/**
 * Returns the subset of the given placeIds that already exist in PlaceCache.
 * Used by searchNearby to prioritize newly-discovered places within the
 * results cap, instead of re-surfacing places already searched before.
 */
export async function getCachedPlaceIds(placeIds: string[]): Promise<Set<string>> {
  if (placeIds.length === 0) return new Set();
  const rows = await prisma.placeCache.findMany({
    where: { placeId: { in: placeIds } },
    select: { placeId: true },
  });
  return new Set(rows.map((r) => r.placeId));
}

/**
 * Returns previously-discovered businesses (from any past search) located
 * within radiusMeters of center, with their Score NZT if already analyzed.
 *
 * Free — no Places API call. Used to keep already-found pins on the map and
 * avoid spending search quota on businesses we've already discovered.
 */
export async function getCachedPlacesNearby(
  center: PlaceLocation,
  radiusMeters: number
): Promise<PlaceSummary[]> {
  // Bounding box in degrees, refined below with exact haversine distance.
  const latDelta = radiusMeters / 111_320;
  const cosLat = Math.cos((center.latitude * Math.PI) / 180) || 1e-6;
  const lngDelta = radiusMeters / (111_320 * cosLat);

  const rows = await prisma.placeCache.findMany({
    where: {
      latitude: { gte: center.latitude - latDelta, lte: center.latitude + latDelta },
      longitude: { gte: center.longitude - lngDelta, lte: center.longitude + lngDelta },
    },
    select: SELECT,
  });

  return rows
    .filter(
      (row) =>
        haversineDistance(center.latitude, center.longitude, row.latitude, row.longitude) <=
        radiusMeters
    )
    .map((row) => {
      const opportunities = row.opportunities;
      const score = Array.isArray(opportunities)
        ? computeScore(opportunities as unknown as DetectedOpportunity[])
        : null;
      return {
        placeId: row.placeId,
        name: row.name,
        formattedAddress: row.formattedAddress,
        location: { latitude: row.latitude, longitude: row.longitude },
        types: row.types,
        primaryType: row.primaryType,
        businessStatus: (row.businessStatus ?? "UNKNOWN") as PlaceBusinessStatus,
        rating: row.rating,
        userRatingCount: row.userRatingCount,
        score,
      };
    });
}

/**
 * Returns the Score NZT (0-9) for places that already have computed
 * opportunities cached. Places without a detail fetch yet are omitted —
 * the UI shows them as "not yet analyzed" (neutral color).
 */
export async function getCachedOpportunityScores(
  placeIds: string[]
): Promise<Map<string, number>> {
  if (placeIds.length === 0) return new Map();
  const rows = await prisma.placeCache.findMany({
    where: { placeId: { in: placeIds }, opportunities: { not: Prisma.JsonNull } },
    select: { placeId: true, opportunities: true },
  });

  const scores = new Map<string, number>();
  for (const row of rows) {
    const opportunities = row.opportunities;
    if (!Array.isArray(opportunities)) continue;
    scores.set(row.placeId, computeScore(opportunities as unknown as DetectedOpportunity[]));
  }
  return scores;
}

// ─── Write helpers — search data ──────────────────────────────────────────────

/**
 * Upserts a single PlaceSummary into the cache.
 *
 * On CREATE: inserts all search-level fields.
 * On UPDATE: refreshes search-level fields only.
 *            Does NOT overwrite detail fields (websiteUri, phone, etc.)
 *            if they were already loaded via Place Details.
 */
export async function upsertPlaceSummary(
  summary: PlaceSummary,
  raw: unknown
): Promise<void> {
  const searchFields = {
    name: summary.name,
    formattedAddress: summary.formattedAddress,
    latitude: summary.location.latitude,
    longitude: summary.location.longitude,
    types: summary.types,
    primaryType: summary.primaryType,
    businessStatus: summary.businessStatus,
    rating: summary.rating,
    userRatingCount: summary.userRatingCount,
    rawSearch: raw as Prisma.InputJsonValue,
    searchFetchedAt: new Date(),
  };

  await prisma.placeCache.upsert({
    where: { placeId: summary.placeId },
    create: { placeId: summary.placeId, source: "google_places", ...searchFields },
    update: searchFields,
  });
}

/**
 * Batch-upserts multiple PlaceSummaries from a Nearby Search response.
 * rawPlaces must be indexed parallel to summaries.
 * Runs upserts concurrently for efficiency.
 */
export async function upsertPlaceSummaries(
  summaries: PlaceSummary[],
  rawPlaces: unknown[]
): Promise<void> {
  await Promise.all(
    summaries.map((summary, i) => upsertPlaceSummary(summary, rawPlaces[i]))
  );
}

// ─── Write helpers — detail data ──────────────────────────────────────────────

/**
 * Upserts full detail data for a place.
 * Used when Place Details are fetched (with or without a prior search).
 *
 * On CREATE: inserts all fields (search + detail).
 * On UPDATE: refreshes all fields, including detail data and detailFetchedAt.
 */
export async function upsertPlaceDetail(
  detail: PlaceDetail,
  raw: unknown
): Promise<void> {
  const now = new Date();

  const allFields = {
    name: detail.name,
    formattedAddress: detail.formattedAddress,
    latitude: detail.location.latitude,
    longitude: detail.location.longitude,
    types: detail.types,
    primaryType: detail.primaryType,
    businessStatus: detail.businessStatus,
    rating: detail.rating,
    userRatingCount: detail.userRatingCount,
    websiteUri: detail.websiteUri,
    nationalPhone: detail.nationalPhone,
    internationalPhone: detail.internationalPhone,
    googleMapsUri: detail.googleMapsUri,
    hasOpeningHours: detail.hasOpeningHours,
    openingHoursDescriptions: detail.openingHoursDescriptions,
    rawDetail: raw as Prisma.InputJsonValue,
    detailFetchedAt: now,
  };

  await prisma.placeCache.upsert({
    where: { placeId: detail.placeId },
    create: {
      placeId: detail.placeId,
      source: "google_places",
      searchFetchedAt: now,
      ...allFields,
    },
    update: allFields,
  });
}

// ─── Write helpers — computed data ────────────────────────────────────────────

/**
 * Persists computed signals and opportunities for a cached record.
 * Called by the rule engine after computing them from PlaceDetail (NZT-78).
 */
export async function updateCacheSignals(
  placeId: string,
  signals: unknown,
  opportunities: unknown
): Promise<void> {
  await prisma.placeCache.update({
    where: { placeId },
    data: {
      signals: signals as Prisma.InputJsonValue,
      opportunities: opportunities as Prisma.InputJsonValue,
    },
  });
}

/**
 * Persists a web audit result for a cached record.
 * Called by auditPlaceWebsiteAction after running the audit (sin API keys).
 */
export async function updateCacheWebAudit(
  placeId: string,
  webAudit: unknown
): Promise<void> {
  await prisma.placeCache.update({
    where: { placeId },
    data: {
      webAudit: webAudit as Prisma.InputJsonValue,
      webAuditFetchedAt: new Date(),
    },
  });
}

// ─── Write helpers — CRM link ─────────────────────────────────────────────────

/**
 * Links a PlaceCache record to a Company after the user saves it as a candidate.
 * The @unique constraint on companyId is enforced at the DB level.
 * Called by saveAsCompanyAction (NZT-81).
 */
export async function linkPlaceCacheToCompany(
  placeId: string,
  companyId: string
): Promise<void> {
  await prisma.placeCache.update({
    where: { placeId },
    data: { companyId },
  });
}
