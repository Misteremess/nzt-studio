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
  linkPlaceCacheToCompany,
  type PlaceCacheRow,
} from "@/features/analyzer/lib/place-cache";
import { isCacheValid, ANALYZER_CONFIG } from "@/features/analyzer/lib/config";
import { computeSignalsAndOpportunities } from "@/features/analyzer/lib/opportunity-rules";
import { searchInputSchema, fetchDetailInputSchema } from "@/features/analyzer/schemas";
import { getSectorLabel } from "@/features/analyzer/lib/categories";
import { prisma } from "@/db/prisma";
import { revalidatePath } from "next/cache";
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

  const { locationText, radiusMeters, placeType, maxResults, coordinates } = parsed.data;
  const cappedRadius = Math.min(radiusMeters, ANALYZER_CONFIG.maxRadiusMeters);
  const cappedResults = Math.min(maxResults, ANALYZER_CONFIG.maxResults);

  // 2. Resolve center — use explicit coordinates (map click) or geocode text
  let center: PlaceLocation;
  if (coordinates) {
    center = coordinates;
  } else {
    try {
      center = await geocodeLocation(locationText);
    } catch (err) {
      return placesErrorResult(err);
    }
  }

  // 3. Search nearby
  let searchResult: Awaited<ReturnType<typeof searchNearby>>;
  try {
    searchResult = await searchNearby(
      center,
      cappedRadius,
      placeType,
      cappedResults
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

// ─── Save as Company action ────────────────────────────────────────────────────

export interface SaveAsCompanyData {
  companyId: string;
  /** True if the company already existed (placeId already linked) */
  alreadyExisted: boolean;
}

/**
 * Saves a discovered business as a Company candidate in the CRM.
 * Always manual — never called automatically.
 *
 * Flow:
 *   1. Load PlaceCache row for placeId
 *   2. If already linked to a Company, return it (idempotent)
 *   3. Map place data → Company fields
 *   4. Create Company with status PROSPECT
 *   5. Link PlaceCache → Company
 *   6. Revalidate /companies cache
 */
export async function saveAsCompanyAction(
  placeId: string
): Promise<ActionResult<SaveAsCompanyData>> {
  let cached: PlaceCacheRow | null;
  try {
    cached = await getPlaceCacheByPlaceId(placeId);
  } catch {
    return { ok: false, error: "Error al acceder a la caché.", errorCode: "DB_ERROR" };
  }

  if (!cached) {
    return {
      ok: false,
      error: "Negocio no encontrado en caché. Carga el detalle antes de guardar.",
      errorCode: "NOT_FOUND",
    };
  }

  // Idempotent: already linked to a Company
  if (cached.companyId) {
    return { ok: true, data: { companyId: cached.companyId, alreadyExisted: true } };
  }

  const phone = cached.nationalPhone ?? cached.internationalPhone;
  const sector = getSectorLabel(cached.primaryType ?? "");
  const opportunities = parseCachedJson<DetectedOpportunity[]>(cached.opportunities) ?? [];

  // Build notes from available data
  const noteLines: string[] = [
    "Descubierta via Google Places Analyzer.",
    "Fuente: Google Places API (New)",
    `Place ID: ${cached.placeId}`,
  ];
  if (cached.formattedAddress) noteLines.push(`Dirección: ${cached.formattedAddress}`);
  if (cached.rating !== null)
    noteLines.push(`Rating: ${cached.rating} (${cached.userRatingCount ?? 0} reseñas)`);
  if (cached.businessStatus) noteLines.push(`Estado: ${cached.businessStatus}`);
  if (opportunities.length > 0) {
    noteLines.push("\nOportunidades detectadas:");
    opportunities.forEach((o) => noteLines.push(`- ${o.title}`));
  }
  noteLines.push(`\nGuardada el ${new Date().toLocaleDateString("es-ES")}.`);

  let companyId: string;
  try {
    const company = await prisma.company.create({
      data: {
        name: cached.name,
        sector: sector || null,
        website: cached.websiteUri,
        phone: phone ?? null,
        mapsUrl: cached.googleMapsUri,
        notes: noteLines.join("\n"),
        status: "PROSPECT",
      },
      select: { id: true },
    });
    companyId = company.id;
  } catch {
    return {
      ok: false,
      error: "Error al guardar la empresa. Inténtalo de nuevo.",
      errorCode: "DB_ERROR",
    };
  }

  try {
    await linkPlaceCacheToCompany(placeId, companyId);
  } catch {
    // Non-blocking: company was created, only the link failed
    console.error("[Analyzer] Failed to link PlaceCache to Company", placeId, companyId);
  }

  revalidatePath("/companies");

  return { ok: true, data: { companyId, alreadyExisted: false } };
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
