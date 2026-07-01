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

// ─── Exhaustive area coverage (global-lattice refinement) ──────────────────────
//
// The Places API (New) searchNearby returns at most 20 results per request and
// has NO pagination (unlike Text Search). A single circle can therefore never
// surface more than 20 businesses no matter how many exist.
//
// To search an area EXHAUSTIVELY we use `rankPreference: DISTANCE`: results come
// back nearest-first, so a circle that returns FEWER than 20 results is provably
// complete — there are no more businesses within it. Circles that return the
// full 20 may be hiding more, so we refine ONLY those regions with a finer grid
// and repeat until no circle is saturated (or we hit the min cell size / call
// ceiling).
//
// The refinement grid is a global square lattice (spacing = r·√2, which exactly
// tiles the plane with radius-r circles) anchored at the original centre, so
// cells never overlap-search across refinement passes — only genuinely dense
// sub-regions get drilled down, keeping the API-call count low.

/** Below this cell radius we stop refining (bounds cost in ultra-dense zones). */
const MIN_CELL_RADIUS = 60;
/** Hard ceiling on Places API calls per search — bounds worst-case cost/latency. */
const MAX_API_CALLS = 250;
/** Requests fired concurrently per wave. */
const SEARCH_CONCURRENCY = 12;

interface Cell {
  center: PlaceLocation;
  radius: number;
}

/**
 * Generates a global square lattice of radius-`r` circles that fully covers the
 * disk of radius `areaRadius` around `origin`. Spacing is r·√2 — the exact step
 * at which radius-r circles tile the plane with no gaps. Anchoring every pass at
 * `origin` keeps lattices aligned across refinement levels, so refined cells
 * from different saturated parents coincide instead of overlap-searching.
 */
function latticeCells(origin: PlaceLocation, areaRadius: number, r: number): Cell[] {
  const spacing = r * Math.SQRT2;
  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos((origin.latitude * Math.PI) / 180));
  const reach = areaRadius + r;
  const n = Math.ceil(reach / spacing);

  const cells: Cell[] = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const dy = i * spacing;
      const dx = j * spacing;
      if (Math.sqrt(dx * dx + dy * dy) > reach) continue;
      cells.push({
        center: {
          latitude: origin.latitude + dy * latPerMeter,
          longitude: origin.longitude + dx * lngPerMeter,
        },
        radius: r,
      });
    }
  }
  return cells;
}

/** Great-circle distance in metres between two coordinates. */
function haversineMeters(a: PlaceLocation, b: PlaceLocation): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface CellResult {
  places: PlaceSummary[];
  rawPlaces: RawPlace[];
  /** True when the API returned the full page (20) — cell may be saturated. */
  saturated: boolean;
}

/** Single searchNearby request for one cell, ranked by DISTANCE. */
async function fetchCell(
  cell: Cell,
  placeType: string,
  key: string,
): Promise<CellResult> {
  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: {
        center: { latitude: cell.center.latitude, longitude: cell.center.longitude },
        radius: cell.radius,
      },
    },
    ...(placeType === OTHER_PLACE_TYPE ? {} : { includedTypes: [placeType] }),
    // DISTANCE ranking is what makes exhaustive coverage provable (see header).
    rankPreference: "DISTANCE",
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

  return {
    places: valid.map(toPlaceSummary),
    rawPlaces: valid,
    saturated: rawPage.length >= PLACES_API_MAX_PER_PAGE,
  };
}

/** Runs a batch of cells in concurrency-limited waves. */
async function runCells(
  cells: Cell[],
  placeType: string,
  key: string,
  callBudget: number,
  onResult: (cell: Cell, result: CellResult) => void,
  onError: (err: unknown) => void,
): Promise<number> {
  let used = 0;
  for (let start = 0; start < cells.length && used < callBudget; start += SEARCH_CONCURRENCY) {
    const room = callBudget - used;
    const wave = cells.slice(start, start + Math.min(SEARCH_CONCURRENCY, room));
    used += wave.length;
    const settled = await Promise.allSettled(
      wave.map((cell) => fetchCell(cell, placeType, key))
    );
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") onResult(wave[i], res.value);
      else onError(res.reason);
    });
  }
  return used;
}

/**
 * Searches for ALL businesses of the given type within `radiusMeters` of
 * `center`. Starts with the full circle and, using DISTANCE ranking, refines
 * only the saturated sub-regions with a progressively finer global lattice
 * until nothing is saturated (complete) or the min cell size / call ceiling is
 * reached. Results are deduplicated by placeId and clipped to `radiusMeters`.
 *
 * @throws PlacesApiError if the very first request fails (found nothing at all).
 */
export async function searchNearby(
  center: PlaceLocation,
  radiusMeters: number,
  placeType: string,
): Promise<NearbySearchResult> {
  const key = getKey();
  const cappedRadius = Math.min(radiusMeters, ANALYZER_CONFIG.maxRadiusMeters);

  const seen = new Map<string, { place: PlaceSummary; raw: RawPlace }>();
  let firstError: unknown = null;
  let apiCalls = 0;

  let cells: Cell[] = [{ center, radius: cappedRadius }];
  let radius = cappedRadius;

  const collect = (_cell: Cell, result: CellResult) => {
    const { places, rawPlaces } = result;
    for (let j = 0; j < places.length; j++) {
      const p = places[j];
      // Clip to the requested circle — lattice cells extend slightly beyond it.
      if (haversineMeters(center, p.location) > cappedRadius) continue;
      if (!seen.has(p.placeId)) seen.set(p.placeId, { place: p, raw: rawPlaces[j] });
    }
  };

  while (cells.length > 0 && apiCalls < MAX_API_CALLS) {
    const saturatedParents: Cell[] = [];
    apiCalls += await runCells(
      cells,
      placeType,
      key,
      MAX_API_CALLS - apiCalls,
      (cell, result) => {
        collect(cell, result);
        if (result.saturated) saturatedParents.push(cell);
      },
      (err) => {
        firstError ??= err;
      },
    );

    // No cell hit the 20-result cap → the whole area is exhaustively covered.
    if (saturatedParents.length === 0) break;

    const nextRadius = radius / 2;
    if (nextRadius < MIN_CELL_RADIUS) break; // finest resolution reached

    radius = nextRadius;
    // Refine only where it was dense: keep lattice cells whose centre falls
    // inside a saturated parent circle.
    const candidate = latticeCells(center, cappedRadius, radius);
    cells = candidate.filter((c) =>
      saturatedParents.some((s) => haversineMeters(c.center, s.center) <= s.radius)
    );
  }

  // Only surface an error if we found nothing at all — partial failures in a
  // few cells shouldn't discard everything else we successfully collected.
  if (seen.size === 0 && firstError) throw firstError;

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Rastreador] searchNearby: ${apiCalls} API calls, ${seen.size} businesses (radius ${cappedRadius}m)`
    );
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
