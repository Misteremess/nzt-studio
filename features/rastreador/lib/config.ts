// features/analyzer/lib/config.ts
// Server-side configuration for the Local Business Analyzer.
// Reads environment variables with safe, documented defaults.
//
// Server-only: importing this file from a client component will throw at build time.
// UI-safe constants (ANALYZER_RADIUS_OPTIONS) live in constants.ts instead.
import "server-only";

/**
 * Places API (New) hard cap per Nearby Search request.
 * Each page returns at most 20 places; pagination is required for more.
 */
export const PLACES_API_MAX_PER_PAGE = 20;

/**
 * Places API (New) searchNearby practical ceiling.
 * The API returns up to 20 results per request and rarely emits nextPageToken
 * for filtered category searches — pagination is supported in the code but
 * not reliably triggered by the API. 20 is the effective per-request cap.
 */
const PLACES_API_MAX_TOTAL = 20;

/** Places API (New) absolute max radius in meters */
const PLACES_API_MAX_RADIUS = 50_000;

export const ANALYZER_CONFIG = {
  /**
   * Maximum total places returned per search.
   * Capped at 20 — the Places API (New) searchNearby hard limit per request.
   * Override via ANALYZER_MAX_RESULTS env var (max 20).
   */
  maxResults: Math.min(
    parseInt(process.env.ANALYZER_MAX_RESULTS ?? "20", 10) || 20,
    PLACES_API_MAX_TOTAL
  ),

  /**
   * Maximum search radius in meters.
   * Default: 10 000 m (10 km). Override via ANALYZER_MAX_RADIUS_METERS.
   */
  maxRadiusMeters: Math.min(
    parseInt(process.env.ANALYZER_MAX_RADIUS_METERS ?? "10000", 10) || 10000,
    PLACES_API_MAX_RADIUS
  ),

  /**
   * Cache TTL in days. PlaceCache rows older than this are considered stale
   * and will trigger a fresh API call on next access.
   * Default: 7 days.
   */
  cacheTtlDays: parseInt(process.env.ANALYZER_CACHE_TTL_DAYS ?? "7", 10) || 7,
} as const;

/**
 * Returns true if the cached record is still within the TTL window.
 * @param fetchedAt - The timestamp when the data was fetched from the API.
 * @param ttlDays   - Override the default TTL from config.
 */
export function isCacheValid(
  fetchedAt: Date,
  ttlDays: number = ANALYZER_CONFIG.cacheTtlDays
): boolean {
  const ageMs = Date.now() - fetchedAt.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return ageMs < ttlMs;
}

/**
 * Validates that the Google Places API key is configured.
 * Throws if missing so the caller can return a clear error to the user.
 */
export function requirePlacesApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is not configured. " +
        "Add it to .env.local and restart the server."
    );
  }
  return key;
}
