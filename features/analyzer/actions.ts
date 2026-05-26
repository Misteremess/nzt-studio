"use server";
// features/analyzer/actions.ts
// Server Actions for the Local Business Analyzer.
//
// Called directly from Client Component event handlers (not via <form>).
// All Google Places API calls and Prisma access happen exclusively here.
// The API key never leaves the server.

import {
  geocodeLocation,
  searchNearby,
  fetchPlaceDetail,
  PlacesApiError,
} from "@/features/analyzer/lib/google-places";
import {
  getPlaceCacheByPlaceId,
  upsertPlaceSummaries,
  upsertPlaceDetail,
  updateCacheSignals,
  type PlaceCacheRow,
} from "@/features/analyzer/lib/place-cache";
import { isCacheValid, ANALYZER_CONFIG } from "@/features/analyzer/lib/config";
import { computeSignalsAndOpportunities } from "@/features/analyzer/lib/opportunity-rules";
import { searchInputSchema, fetchDetailInputSchema } from "@/features/analyzer/schemas";
import type {
  PlaceSummary,
  PlaceDetail,
  PlaceSignals,
  DetectedOpportunity,
  PlaceLocation,
  PlaceBusinessStatus,
} from "@/features/analyzer/types";

// ─── Result type ──────────────────────────────────────────────────────────────

/**
 * Discriminated union returned by all Analyzer actions.
 * Callers check `result.ok` before accessing `result.data`.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

// ─── Search action ─────────────────────────────────────────────────────────────

export interface SearchActionData {
  /** Normalized list of businesses from the search */
  places: PlaceSummary[];
  /** Geocoded center used for the search — useful for centering the map */
  center: PlaceLocation;
  /** Radius that was actually applied (may be capped by config) */
  radiusMeters: number;
}

/**
 * Searches for local businesses near a text location.
 *
 * Flow:
 *   1. Validate input (Zod)
 *   2. Geocode locationText → lat/lng
 *   3. Call Google Places Nearby Search
 *   4. Batch-upsert results in PlaceCache (search data only, no detail yet)
 *   5. Return PlaceSummary[] + geocoded center
 *
 * @param input - Validated search parameters from the UI form
 */
export async function searchPlacesAction(
  input: unknown
): Promise<ActionResult<SearchActionData>> {
  // 1. Validate input
  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Parámetros de búsqueda no válidos.";
    return { ok: false, error: firstError, errorCode: "INVALID_INPUT" };
  }

  const { locationText, radiusMeters, placeType } = parsed.data;
  const cappedRadius = Math.min(radiusMeters, ANALYZER_CONFIG.maxRadiusMeters);

  // 2. Geocode location text
  let center: PlaceLocation;
  try {
    center = await geocodeLocation(locationText);
  } catch (err) {
    return placesErrorResult(err);
  }

  // 3. Search nearby
  let searchResult: Awaited<ReturnType<typeof searchNearby>>;
  try {
    searchResult = await searchNearby(
      center,
      cappedRadius,
      placeType,
      ANALYZER_CONFIG.maxResults
    );
  } catch (err) {
    return placesErrorResult(err);
  }

  const { places, rawPlaces } = searchResult;

  // 4. Persist search results (fire-and-forget style error handling)
  //    A cache write failure should not block the UI from seeing results.
  if (places.length > 0) {
    try {
      await upsertPlaceSummaries(places, rawPlaces);
    } catch {
      // Log in production observability; don't surface to user
      console.error("[Analyzer] PlaceCache upsert failed after search");
    }
  }

  // 5. Return
  return {
    ok: true,
    data: { places, center, radiusMeters: cappedRadius },
  };
}

// ─── Detail action ─────────────────────────────────────────────────────────────

export interface DetailActionData {
  detail: PlaceDetail;
  signals: PlaceSignals;
  opportunities: DetectedOpportunity[];
  /** True if data was served from PlaceCache without an API call */
  fromCache: boolean;
  /** Set if this place was already saved as a Company candidata */
  companyId: string | null;
}

/**
 * Loads full details for a specific business by Google Places ID.
 *
 * Cache strategy:
 *   - If PlaceCache has fresh detail (within ANALYZER_CACHE_TTL_DAYS), return it.
 *   - Otherwise call Google Places Details API, compute signals + opportunities,
 *     persist everything to PlaceCache, and return.
 *
 * @param placeId - Google Places ID from a prior search result
 */
export async function fetchPlaceDetailAction(
  placeId: string
): Promise<ActionResult<DetailActionData>> {
  // Validate input
  const parsed = fetchDetailInputSchema.safeParse({ placeId });
  if (!parsed.success) {
    return { ok: false, error: "Place ID no válido.", errorCode: "INVALID_INPUT" };
  }

  // Check cache
  let cached: PlaceCacheRow | null = null;
  try {
    cached = await getPlaceCacheByPlaceId(placeId);
  } catch {
    // DB read failure: fall through to fresh API call
    console.error("[Analyzer] PlaceCache read failed for", placeId);
  }

  // Serve from cache if detail is fresh
  if (cached?.detailFetchedAt && isCacheValid(cached.detailFetchedAt)) {
    const detail = rowToDetail(cached);
    const signals = parseCachedJson<PlaceSignals>(cached.signals) ?? computeSignalsAndOpportunities(detail).signals;
    const opportunities = parseCachedJson<DetectedOpportunity[]>(cached.opportunities) ?? [];
    return {
      ok: true,
      data: { detail, signals, opportunities, fromCache: true, companyId: cached.companyId },
    };
  }

  // Cache miss or stale — fetch from Places API
  let apiDetail: PlaceDetail;
  let apiRaw: unknown;
  try {
    const result = await fetchPlaceDetail(placeId);
    apiDetail = result.detail;
    apiRaw = result.raw;
  } catch (err) {
    return placesErrorResult(err);
  }

  // Compute signals and opportunities
  const { signals, opportunities } = computeSignalsAndOpportunities(apiDetail);

  // Persist detail + computed data (non-blocking on failure)
  try {
    await upsertPlaceDetail(apiDetail, apiRaw);
    await updateCacheSignals(placeId, signals, opportunities);
  } catch {
    console.error("[Analyzer] PlaceCache update failed after detail fetch for", placeId);
  }

  return {
    ok: true,
    data: {
      detail: apiDetail,
      signals,
      opportunities,
      fromCache: false,
      companyId: cached?.companyId ?? null,
    },
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Reconstructs a PlaceDetail from a PlaceCacheRow.
 * Used to hydrate the detail type from cached DB data.
 */
function rowToDetail(row: PlaceCacheRow): PlaceDetail {
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
    websiteUri: row.websiteUri,
    nationalPhone: row.nationalPhone,
    internationalPhone: row.internationalPhone,
    googleMapsUri: row.googleMapsUri,
    hasOpeningHours: row.hasOpeningHours,
    openingHoursDescriptions: row.openingHoursDescriptions,
  };
}

/**
 * Safely parses a Prisma JsonValue into a typed object.
 * Returns null if the value is missing, null, or not an object.
 */
function parseCachedJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return null;
  return value as T;
}

/**
 * Maps a caught error to an ActionResult failure.
 * Handles PlacesApiError with user-friendly messages and other errors generically.
 */
function placesErrorResult(err: unknown): ActionResult<never> {
  if (err instanceof PlacesApiError) {
    return { ok: false, error: err.userMessage, errorCode: err.code };
  }
  return {
    ok: false,
    error: "Error inesperado. Inténtalo de nuevo.",
    errorCode: "UNKNOWN",
  };
}
