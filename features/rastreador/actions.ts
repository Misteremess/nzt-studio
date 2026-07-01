"use server";
// features/analyzer/actions.ts
// Server Actions for the Local Business Analyzer.
//
// Called directly from Client Component event handlers (not via <form>).
// All Google Places API calls and Prisma access happen exclusively here.
// The API key never leaves the server.

import { requireSession } from "@/lib/auth/require-session";
import {
  geocodeLocation,
  searchNearby,
  fetchPlaceDetail,
  PlacesApiError,
} from "@/features/rastreador/lib/google-places";
import {
  getPlaceCacheByPlaceId,

  getCachedOpportunityScores,
  getCachedPlacesNearby,
  upsertPlaceSummaries,
  upsertPlaceDetail,
  updateCacheSignals,
  updateCacheWebAudit,
  linkPlaceCacheToCompany,
  type PlaceCacheRow,
} from "@/features/rastreador/lib/place-cache";
import { runWebAudit } from "@/features/rastreador/lib/web-audit";
import { isCacheValid, ANALYZER_CONFIG } from "@/features/rastreador/lib/config";
import { computeSignalsAndOpportunities } from "@/features/rastreador/lib/opportunity-rules";
import { searchInputSchema, fetchDetailInputSchema } from "@/features/rastreador/schemas";
import { getSectorLabel } from "@/features/rastreador/lib/categories";
import { prisma } from "@/db/prisma";
import { revalidatePath } from "next/cache";
import type {
  PlaceSummary,
  PlaceDetail,
  PlaceSignals,
  DetectedOpportunity,
  PlaceLocation,
  PlaceBusinessStatus,
  WebAuditResult,
} from "@/features/rastreador/types";

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

  const { locationText, radiusMeters, placeType, coordinates } = parsed.data;
  const cappedRadius = Math.min(radiusMeters, ANALYZER_CONFIG.maxRadiusMeters);

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

  // 3. Grid search — tiles the area with overlapping sub-circles and runs them
  //    in parallel, then deduplicates by placeId. Returns all businesses found
  //    regardless of prior cache state; the view merges with session pins.
  let searchResult: Awaited<ReturnType<typeof searchNearby>>;
  try {
    searchResult = await searchNearby(center, cappedRadius, placeType);
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

  // 5. Attach opportunity scores for places already analyzed before, so the
  //    map can color pins by potential without re-fetching every detail.
  let placesWithScores = places;
  if (places.length > 0) {
    try {
      const scores = await getCachedOpportunityScores(places.map((p) => p.placeId));
      placesWithScores = places.map((p) => ({
        ...p,
        score: scores.get(p.placeId) ?? null,
      }));
    } catch {
      console.error("[Analyzer] Failed to load cached opportunity scores");
    }
  }

  // 6. Merge in previously-discovered places near this center that the API
  //    page didn't return — free (no API call), keeps already-found pins on
  //    the map across searches without spending search quota.
  try {
    const cachedNearby = await getCachedPlacesNearby(center, cappedRadius);
    const seen = new Set(placesWithScores.map((p) => p.placeId));
    for (const cp of cachedNearby) {
      if (!seen.has(cp.placeId)) {
        placesWithScores.push(cp);
        seen.add(cp.placeId);
      }
    }
  } catch {
    console.error("[Analyzer] Failed to load cached nearby places");
  }

  // 7. Return
  return {
    ok: true,
    data: { places: placesWithScores, center, radiusMeters: cappedRadius },
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
  /** Cached web audit, if one was run before (may be stale — UI can re-run) */
  webAudit: WebAuditResult | null;
  /** ISO timestamp of when the detail data was last fetched from Google Places */
  detailFetchedAt: string | null;
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
      data: {
        detail,
        signals,
        opportunities,
        fromCache: true,
        companyId: cached.companyId,
        webAudit: parseCachedJson<WebAuditResult>(cached.webAudit),
        detailFetchedAt: cached.detailFetchedAt.toISOString(),
      },
    };
  }

  // Cache miss or stale — fetch from Places API
  try {
    return await fetchAndPersistDetail(placeId, cached);
  } catch (err) {
    return placesErrorResult(err);
  }
}

// ─── Refresh detail action ─────────────────────────────────────────────────────

/**
 * Forces a fresh fetch of a business's details from the Places API,
 * bypassing the cache TTL. Used by the "Actualizar datos" button when the
 * cached data is old.
 *
 * @param placeId - Google Places ID from a prior search result
 */
export async function refreshPlaceDetailAction(
  placeId: string
): Promise<ActionResult<DetailActionData>> {
  const parsed = fetchDetailInputSchema.safeParse({ placeId });
  if (!parsed.success) {
    return { ok: false, error: "Place ID no válido.", errorCode: "INVALID_INPUT" };
  }

  let cached: PlaceCacheRow | null = null;
  try {
    cached = await getPlaceCacheByPlaceId(placeId);
  } catch {
    console.error("[Analyzer] PlaceCache read failed for", placeId);
  }

  try {
    return await fetchAndPersistDetail(placeId, cached);
  } catch (err) {
    return placesErrorResult(err);
  }
}

/**
 * Fetches fresh detail data from the Places API, computes signals and
 * opportunities, and persists everything to PlaceCache.
 * Shared by fetchPlaceDetailAction (cache miss/stale) and
 * refreshPlaceDetailAction (forced refresh).
 */
async function fetchAndPersistDetail(
  placeId: string,
  cached: PlaceCacheRow | null
): Promise<ActionResult<DetailActionData>> {
  const result = await fetchPlaceDetail(placeId);
  const apiDetail = result.detail;
  const apiRaw = result.raw;

  // Compute signals and opportunities
  const { signals, opportunities } = computeSignalsAndOpportunities(apiDetail);

  const now = new Date();

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
      webAudit: parseCachedJson<WebAuditResult>(cached?.webAudit ?? null),
      detailFetchedAt: now.toISOString(),
    },
  };
}

// ─── Web audit action ──────────────────────────────────────────────────────────

export interface WebAuditActionData {
  audit: WebAuditResult;
  /** True if served from PlaceCache without re-fetching the website */
  fromCache: boolean;
}

/**
 * Audita la web de un negocio cacheado (fetch directo al HTML, sin API keys).
 *
 * Cache strategy: igual que el detalle — si la auditoría guardada está dentro
 * del TTL se devuelve tal cual; si no, se re-audita y se persiste.
 * Requiere que el detalle se haya cargado antes (necesita websiteUri).
 */
export async function auditPlaceWebsiteAction(
  placeId: string
): Promise<ActionResult<WebAuditActionData>> {
  const parsed = fetchDetailInputSchema.safeParse({ placeId });
  if (!parsed.success) {
    return { ok: false, error: "Place ID no válido.", errorCode: "INVALID_INPUT" };
  }

  let cached: PlaceCacheRow | null;
  try {
    cached = await getPlaceCacheByPlaceId(placeId);
  } catch {
    return { ok: false, error: "Error al acceder a la caché.", errorCode: "DB_ERROR" };
  }

  if (!cached) {
    return {
      ok: false,
      error: "Negocio no encontrado en caché. Carga el detalle antes de auditar.",
      errorCode: "NOT_FOUND",
    };
  }

  if (!cached.websiteUri) {
    return {
      ok: false,
      error: "Este negocio no tiene web que auditar.",
      errorCode: "NO_WEBSITE",
    };
  }

  // Serve from cache if a fresh audit exists
  const cachedAudit = parseCachedJson<WebAuditResult>(cached.webAudit);
  if (cachedAudit && cached.webAuditFetchedAt && isCacheValid(cached.webAuditFetchedAt)) {
    return { ok: true, data: { audit: cachedAudit, fromCache: true } };
  }

  // runWebAudit never throws — network failures become reachable=false
  const audit = await runWebAudit(cached.websiteUri);

  try {
    await updateCacheWebAudit(placeId, audit);
  } catch {
    // Non-blocking: the audit ran fine, only persistence failed
    console.error("[Rastreador] PlaceCache web audit update failed for", placeId);
  }

  return { ok: true, data: { audit, fromCache: false } };
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
  const city = extractCity(cached.formattedAddress);
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
        city: city,
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
 * Extracts the city name from a Google Places formattedAddress string.
 * Spanish format: "Street, PostalCode City, Province, Country"
 * Takes the second-to-last segment and strips any leading 5-digit postal code.
 * Returns null if the address has fewer than 2 segments or extraction yields nothing.
 */
function extractCity(formattedAddress: string | null): string | null {
  if (!formattedAddress) return null;
  const parts = formattedAddress.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const candidate = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  return candidate.replace(/^\d{5}\s*/, "").trim() || null;
}

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
    score: null,
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
