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
  const key = requirePlacesApiKey();

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
 * Maximum number of extra pages fetched beyond the first when trying to
 * surface places not already in PlaceCache (see `isKnownPlaceId`).
 * Caps the worst-case API cost for broad "Otros" searches.
 */
const MAX_EXTRA_PAGES = 3;

/**
 * Searches for businesses near a location using Google Places Nearby Search (New).
 * Paginates automatically until `maxResults` are collected or the API has no more pages.
 *
 * Each page fetches up to 20 results (Places API hard limit).
 * Requesting >20 results will therefore generate multiple API calls.
 *
 * @param center         - Center of the search circle (lat/lng)
 * @param radiusMeters   - Search radius in meters (capped by ANALYZER_CONFIG.maxRadiusMeters)
 * @param placeType      - Google Places includedTypes value (e.g. "bakery")
 * @param maxResults     - Total results wanted (capped by ANALYZER_CONFIG.maxResults)
 * @param isKnownPlaceId - Optional lookup for placeIds already in PlaceCache. When
 *                         provided, extra pages (up to MAX_EXTRA_PAGES) are fetched
 *                         while there aren't enough "new" places yet, and the final
 *                         result prioritizes places not seen before.
 *
 * @throws PlacesApiError on any failure
 */
export async function searchNearby(
  center: PlaceLocation,
  radiusMeters: number,
  placeType: string,
  maxResults = ANALYZER_CONFIG.maxResults,
  isKnownPlaceId?: (placeIds: string[]) => Promise<Set<string>>
): Promise<NearbySearchResult> {
  const key = requirePlacesApiKey();
  const cappedRadius = Math.min(radiusMeters, ANALYZER_CONFIG.maxRadiusMeters);
  const totalWanted = Math.min(maxResults, ANALYZER_CONFIG.maxResults);

  const allPlaces: PlaceSummary[] = [];
  const allRaw: RawPlace[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;

  // maxResultCount must be IDENTICAL on every page — Places API (New) rejects
  // paginated requests where any parameter differs from the first request.
  // Always request a full page of 20; slice to totalWanted after the loop.
  const pageSize = PLACES_API_MAX_PER_PAGE;

  do {
    const body: Record<string, unknown> = pageToken
      ? { pageToken }
      : {
          locationRestriction: {
            circle: {
              center: { latitude: center.latitude, longitude: center.longitude },
              radius: cappedRadius,
            },
          },
          // "Otros" has no Google Places type filter — omit includedTypes to
          // search across all business types in the area.
          ...(placeType === OTHER_PLACE_TYPE ? {} : { includedTypes: [placeType] }),
          maxResultCount: pageSize,
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

    if (!response.ok) {
      await handlePlacesHttpError(response);
    }

    const data = (await response.json()) as RawNearbySearchResponse;
    const rawPage = data.places ?? [];

    // Filter out malformed entries and accumulate
    const validPage = rawPage.filter((p) => p.id && p.location);
    allPlaces.push(...validPage.map(toPlaceSummary));
    allRaw.push(...validPage);

    pageToken = data.nextPageToken;
    pagesFetched++;

    // API returned fewer results than the page cap — no more pages available
    if (rawPage.length < pageSize) break;

    if (!pageToken) break;

    if (isKnownPlaceId) {
      // Keep paginating while there aren't enough "new" places yet, up to
      // MAX_EXTRA_PAGES extra pages.
      if (pagesFetched > MAX_EXTRA_PAGES) break;
      const known = await isKnownPlaceId(allPlaces.map((p) => p.placeId));
      const newCount = allPlaces.length - known.size;
      if (newCount >= totalWanted) break;
    } else if (allPlaces.length >= totalWanted) {
      break;
    }
  } while (pageToken);

  // No dedup info available — return the first totalWanted results as before
  if (!isKnownPlaceId || allPlaces.length <= totalWanted) {
    return {
      places: allPlaces.slice(0, totalWanted),
      rawPlaces: allRaw.slice(0, totalWanted),
    };
  }

  // Prioritize places not already in PlaceCache, preserving relative order
  // within each group, so the results cap is spent on new discoveries first.
  const known = await isKnownPlaceId(allPlaces.map((p) => p.placeId));
  const newIdx: number[] = [];
  const knownIdx: number[] = [];
  allPlaces.forEach((p, i) => (known.has(p.placeId) ? knownIdx : newIdx).push(i));
  const order = [...newIdx, ...knownIdx].slice(0, totalWanted);

  return {
    places: order.map((i) => allPlaces[i]),
    rawPlaces: order.map((i) => allRaw[i]),
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
  const key = requirePlacesApiKey();

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
