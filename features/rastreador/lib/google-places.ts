// features/analyzer/lib/google-places.ts
// Server-only client for Google Places API (New) and Google Geocoding API.
//
// Only import this file from Server Components, Server Actions, or other
// server-only modules. The API key is never exposed to the browser.
import "server-only";

import { requirePlacesApiKey, ANALYZER_CONFIG, PLACES_API_MAX_PER_PAGE } from "@/features/rastreador/lib/config";
import { OTHER_PLACE_TYPE } from "@/features/rastreador/lib/categories";
import type { PlaceLocation, PlaceSummary, PlaceDetail, PlaceBusinessStatus } from "@/features/rastreador/types";

// ─── API constants ─────────────────────────────────────────────────────────────

const PLACES_BASE = "https://places.googleapis.com/v1";
const GEOCODING_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

// nextPageToken is NOT a valid X-Goog-FieldMask path (Google returns
// INVALID_ARGUMENT if included). It is a system/pagination field returned
// automatically by the API whenever more pages are available — no mask needed.
const NEARBY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.businessStatus",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
].join(",");

const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "location",
  "types",
  "primaryType",
  "businessStatus",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "websiteUri",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "googleMapsUri",
  "regularOpeningHours",
].join(",");

// ─── Raw API types (internal, not exported) ────────────────────────────────────

interface RawDisplayName {
  text: string;
  languageCode?: string;
}

interface RawLatLng {
  latitude: number;
  longitude: number;
}

interface RawOpeningHours {
  openNow?: boolean;
  weekdayDescriptions?: string[];
}

// Shape returned by both Nearby Search and Place Details
interface RawPlace {
  id?: string;
  displayName?: RawDisplayName;
  location?: RawLatLng;
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  // Detail-only fields
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  regularOpeningHours?: RawOpeningHours;
}

interface RawNearbySearchResponse {
  places?: RawPlace[];
  /** Present when more pages are available. Pass as `pageToken` in the next request. */
  nextPageToken?: string;
}

interface RawGeocodingResult {
  geometry: { location: { lat: number; lng: number } };
}

interface RawGeocodingResponse {
  results: RawGeocodingResult[];
  status: string;
  error_message?: string;
}

interface RawPlacesApiError {
  error?: { code?: number; message?: string; status?: string };
}

// ─── Error class ──────────────────────────────────────────────────────────────

export type PlacesApiErrorCode =
  | "MISSING_KEY"
  | "INVALID_KEY"
  | "API_NOT_ENABLED"
  | "QUOTA_EXCEEDED"
  | "GEOCODING_FAILED"
  | "NO_RESULTS"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export class PlacesApiError extends Error {
  readonly code: PlacesApiErrorCode;
  /** Human-readable message safe to show in the UI */
  readonly userMessage: string;

  constructor(message: string, code: PlacesApiErrorCode, userMessage: string) {
    super(message);
    this.name = "PlacesApiError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

function getKey(): string {
  try {
    return requirePlacesApiKey();
  } catch {
    throw new PlacesApiError(
      "GOOGLE_PLACES_API_KEY is not configured",
      "MISSING_KEY",
      "La clave de API de Google Places no está configurada. Contacta al administrador."
    );
  }
}

// ─── Normalization helpers ─────────────────────────────────────────────────────

function normalizeBusinessStatus(raw?: string): PlaceBusinessStatus {
  switch (raw) {
    case "OPERATIONAL":
      return "OPERATIONAL";
    case "CLOSED_TEMPORARILY":
      return "CLOSED_TEMPORARILY";
    case "CLOSED_PERMANENTLY":
      return "CLOSED_PERMANENTLY";
    default:
      return "UNKNOWN";
  }
}

function toPlaceSummary(place: RawPlace): PlaceSummary {
  return {
    placeId: place.id!,
    name: place.displayName?.text ?? "Sin nombre",
    formattedAddress: place.formattedAddress ?? null,
    location: {
      latitude: place.location!.latitude,
      longitude: place.location!.longitude,
    },
    types: place.types ?? [],
    primaryType: place.primaryType ?? null,
    businessStatus: normalizeBusinessStatus(place.businessStatus),
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    score: null,
  };
}

function toPlaceDetail(place: RawPlace): PlaceDetail {
  const hours = place.regularOpeningHours;
  return {
    ...toPlaceSummary(place),
    websiteUri: place.websiteUri ?? null,
    nationalPhone: place.nationalPhoneNumber ?? null,
    internationalPhone: place.internationalPhoneNumber ?? null,
    googleMapsUri: place.googleMapsUri ?? null,
    hasOpeningHours: !!hours,
    openingHoursDescriptions: hours?.weekdayDescriptions ?? [],
  };
}

// ─── Shared error handler ──────────────────────────────────────────────────────

async function handlePlacesHttpError(response: Response): Promise<never> {
  let body: RawPlacesApiError = {};
  try {
    body = (await response.json()) as RawPlacesApiError;
  } catch {
    // Body may not be JSON (e.g. 502 from a proxy)
  }

  const apiStatus = body.error?.status ?? "";
  const apiMessage = body.error?.message ?? `HTTP ${response.status}`;

  // 401 — invalid key
  if (response.status === 401 || apiStatus === "UNAUTHENTICATED") {
    throw new PlacesApiError(
      `Places API invalid key: ${apiMessage}`,
      "INVALID_KEY",
      "Error de configuración. La clave de API no es válida."
    );
  }

  // 403 — billing, API not enabled, or other permission issue
  if (response.status === 403) {
    if (apiStatus === "RESOURCE_EXHAUSTED") {
      throw new PlacesApiError(
        `Places API quota exceeded: ${apiMessage}`,
        "QUOTA_EXCEEDED",
        "Se ha alcanzado el límite de consultas del día. Inténtalo mañana."
      );
    }
    if (apiStatus === "API_NOT_ACTIVATED") {
      throw new PlacesApiError(
        `Places API not enabled: ${apiMessage}`,
        "API_NOT_ENABLED",
        "La API de Places no está habilitada en tu proyecto de Google Cloud."
      );
    }
    throw new PlacesApiError(
      `Places API access denied: ${apiMessage}`,
      "API_NOT_ENABLED",
      "Error de acceso. Verifica que Places API y Geocoding API están habilitadas y que el billing está activo en Google Cloud Console."
    );
  }

  // 429 — rate limit / quota
  if (response.status === 429 || apiStatus === "RESOURCE_EXHAUSTED") {
    throw new PlacesApiError(
      `Places API quota exceeded: ${apiMessage}`,
      "QUOTA_EXCEEDED",
      "Se ha alcanzado el límite de consultas del día. Inténtalo mañana."
    );
  }

  // Anything else
  throw new PlacesApiError(
    `Places API unexpected error ${response.status}: ${apiMessage}`,
    "INVALID_RESPONSE",
    "Error inesperado del servicio de búsqueda. Inténtalo de nuevo."
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a human-readable location string to lat/lng coordinates.
 * Requires Geocoding API enabled alongside Places API in Google Cloud Console.
 *
 * @throws PlacesApiError on any failure
 */
export async function geocodeLocation(locationText: string): Promise<PlaceLocation> {
  const key = getKey();

  const url = new URL(GEOCODING_BASE);
  url.searchParams.set("address", locationText);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "es");

  let response: Response;
  try {
    response = await fetch(url.toString(), { cache: "no-store" });
  } catch (err) {
    throw new PlacesApiError(
      `Geocoding network error: ${err}`,
      "NETWORK_ERROR",
      "Error de conexión. Comprueba tu red e inténtalo de nuevo."
    );
  }

  if (!response.ok) {
    await handlePlacesHttpError(response);
  }

  const data = (await response.json()) as RawGeocodingResponse;

  if (data.status === "ZERO_RESULTS") {
    throw new PlacesApiError(
      `Geocoding zero results for: "${locationText}"`,
      "GEOCODING_FAILED",
      `No se pudo encontrar "${locationText}". Intenta ser más específico (ej. "Madrid" o "Calle Mayor, Barcelona").`
    );
  }

  if (data.status === "REQUEST_DENIED") {
    throw new PlacesApiError(
      `Geocoding request denied: ${data.error_message ?? ""}`,
      "API_NOT_ENABLED",
      "La clave de API no tiene permisos para geocodificación. Activa la Geocoding API en Google Cloud Console."
    );
  }

  if (data.status === "OVER_QUERY_LIMIT") {
    throw new PlacesApiError(
      "Geocoding over query limit",
      "QUOTA_EXCEEDED",
      "Se ha alcanzado el límite de consultas. Inténtalo más tarde."
    );
  }

  if (data.status !== "OK" || !data.results[0]) {
    throw new PlacesApiError(
      `Geocoding unexpected status: ${data.status}`,
      "GEOCODING_FAILED",
      "No se pudo geocodificar la ubicación. Inténtalo de nuevo."
    );
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { latitude: lat, longitude: lng };
}

// ─── Nearby Search ─────────────────────────────────────────────────────────────

export interface NearbySearchResult {
  /** Normalized PlaceSummary objects */
  places: PlaceSummary[];
  /**
   * Raw RawPlace objects from the API, indexed parallel to `places`.
   * Stored in PlaceCache.rawSearch per record.
   */
  rawPlaces: unknown[];
}

/**
 * Places API (New) searchNearby returns at most 20 results per request and
 * does not reliably paginate for category-filtered searches. To cover the
 * full target area we tile it with overlapping sub-circles and search each
 * one independently, then deduplicate the results by placeId.
 *
 * Grid sizing:
 *   sub-radius  = min(mainRadius / 2.5, 500 m)
 *   spacing     = subRadius × 1.7  (≈30 % overlap → no gaps)
 *   cells       ≤ MAX_GRID_CELLS   (sorted centre-out so densest area first)
 */
const MAX_GRID_CELLS = 20;

function generateSearchGrid(
  center: PlaceLocation,
  radiusMeters: number,
): Array<{ center: PlaceLocation; subRadius: number }> {
  if (radiusMeters <= 400) {
    return [{ center, subRadius: radiusMeters }];
  }

  const subRadius = Math.min(Math.ceil(radiusMeters / 2.5), 500);
  const spacing = Math.ceil(subRadius * 1.7);

  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos((center.latitude * Math.PI) / 180));

  // Iterate from centre outward using integer multiples of spacing so that
  // (0,0) is always the first cell, avoiding the off-by-one that occurred
  // when the loop started at -radiusMeters.
  const n = Math.ceil(radiusMeters / spacing);
  const candidates: Array<{ center: PlaceLocation; subRadius: number; dist: number }> = [];

  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const dy = i * spacing;
      const dx = j * spacing;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radiusMeters) continue;
      candidates.push({
        center: {
          latitude: center.latitude + dy * latPerMeter,
          longitude: center.longitude + dx * lngPerMeter,
        },
        subRadius,
        dist,
      });
    }
  }

  // Sort centre-outward — densest area covered first if we hit MAX_GRID_CELLS.
  candidates.sort((a, b) => a.dist - b.dist);

  return candidates
    .slice(0, MAX_GRID_CELLS)
    .map(({ center: c, subRadius: r }) => ({ center: c, subRadius: r }));
}

/**
 * Fetches one sub-circle: calls searchNearby and follows nextPageToken until
 * the API has no more pages (max 20 per page).
 */
async function fetchSubCircle(
  center: PlaceLocation,
  radiusMeters: number,
  placeType: string,
  key: string,
): Promise<{ places: PlaceSummary[]; rawPlaces: RawPlace[] }> {
  const places: PlaceSummary[] = [];
  const rawPlaces: RawPlace[] = [];
  let pageToken: string | undefined;

  do {
    // When sending a pageToken the body must contain ONLY the token —
    // any other field causes an INVALID_ARGUMENT error from the API.
    const body: Record<string, unknown> = pageToken
      ? { pageToken }
      : {
          locationRestriction: {
            circle: {
              center: { latitude: center.latitude, longitude: center.longitude },
              radius: radiusMeters,
            },
          },
          ...(placeType === OTHER_PLACE_TYPE ? {} : { includedTypes: [placeType] }),
          maxResultCount: PLACES_API_MAX_PER_PAGE,
          languageCode: "es",
        };

    let response: Response;
    try {
      response = await fetch(`${PLACES_BASE}/places:searchNearby`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": NEARBY_FIELD_MASK,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch (err) {
      throw new PlacesApiError(
        `Nearby search network error: ${err}`,
        "NETWORK_ERROR",
        "Error de conexión. Comprueba tu red e inténtalo de nuevo."
      );
    }

    if (!response.ok) await handlePlacesHttpError(response);

    const data = (await response.json()) as RawNearbySearchResponse;
    const rawPage = data.places ?? [];

    const valid = rawPage.filter((p) => p.id && p.location);
    places.push(...valid.map(toPlaceSummary));
    rawPlaces.push(...valid);

    pageToken = data.nextPageToken;
    // Fewer results than the page cap → no more pages for this sub-circle
    if (rawPage.length < PLACES_API_MAX_PER_PAGE) break;
  } while (pageToken);

  return { places, rawPlaces };
}

/**
 * Searches for ALL businesses near a location by tiling the area with
 * overlapping sub-circles (grid search). Each cell is queried in parallel
 * and paginates through its own pages. Results are deduplicated by placeId.
 *
 * @throws PlacesApiError on any failure (first cell error propagated if all fail)
 */
export async function searchNearby(
  center: PlaceLocation,
  radiusMeters: number,
  placeType: string,
): Promise<NearbySearchResult> {
  const key = getKey();
  const cappedRadius = Math.min(radiusMeters, ANALYZER_CONFIG.maxRadiusMeters);
  const grid = generateSearchGrid(center, cappedRadius);

  // Fetch all sub-circles in parallel
  const settled = await Promise.allSettled(
    grid.map((cell) => fetchSubCircle(cell.center, cell.subRadius, placeType, key))
  );

  // Deduplicate across grid cells by placeId
  const seen = new Map<string, { place: PlaceSummary; raw: RawPlace }>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const { places, rawPlaces } = result.value;
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (!seen.has(p.placeId)) {
        seen.set(p.placeId, { place: p, raw: rawPlaces[i] });
      }
    }
  }

  // If every sub-circle failed, surface the first error
  if (seen.size === 0) {
    const firstRejected = settled.find((r) => r.status === "rejected");
    if (firstRejected?.status === "rejected") throw firstRejected.reason;
  }

  const entries = Array.from(seen.values());
  return {
    places: entries.map((e) => e.place),
    rawPlaces: entries.map((e) => e.raw),
  };
}

// ─── Place Details ────────────────────────────────────────────────────────────

export interface PlaceDetailResult {
  /** Normalized PlaceDetail */
  detail: PlaceDetail;
  /** Raw API response — stored in PlaceCache.rawDetail */
  raw: unknown;
}

/**
 * Fetches full details for a specific place using Google Places Details (New).
 *
 * @param placeId - Google Places ID (from PlaceSummary.placeId or PlaceCache.placeId)
 *
 * @throws PlacesApiError on any failure
 */
export async function fetchPlaceDetail(placeId: string): Promise<PlaceDetailResult> {
  const key = getKey();

  let response: Response;
  try {
    response = await fetch(
      `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": DETAIL_FIELD_MASK,
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new PlacesApiError(
      `Place detail network error for ${placeId}: ${err}`,
      "NETWORK_ERROR",
      "Error de conexión. Comprueba tu red e inténtalo de nuevo."
    );
  }

  if (!response.ok) {
    await handlePlacesHttpError(response);
  }

  const raw = (await response.json()) as RawPlace;

  if (!raw.id || !raw.location) {
    throw new PlacesApiError(
      `Place detail missing required fields for ${placeId}`,
      "INVALID_RESPONSE",
      "No se pudo cargar la ficha de este negocio. Inténtalo de nuevo."
    );
  }

  return { detail: toPlaceDetail(raw), raw };
}
