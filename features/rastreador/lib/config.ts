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

/** Places API (New) absolute max radius in meters */
const PLACES_API_MAX_RADIUS = 50_000;

export const ANALYZER_CONFIG = {
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
 * Master kill switch for the Rastreador's Google Places usage.
 *
 * Every billable Places/Geocoding call goes through getKey() in
 * google-places.ts, which refuses to run unless this returns true. It is
 * DISABLED by default and only turns on when RASTREADOR_ENABLED="true" is set
 * in the environment — a safe default so the module can never silently rack up
 * API charges. Re-enable it only after setting a hard quota cap on the Places
 * API in Google Cloud Console.
 */
export function isPlacesApiEnabled(): boolean {
  return process.env.RASTREADOR_ENABLED === "true";
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
