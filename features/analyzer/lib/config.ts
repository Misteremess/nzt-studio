// features/analyzer/lib/config.ts
// Server-side configuration for the Local Business Analyzer.
// Reads environment variables with safe, documented defaults.
//
// IMPORTANT: This file must only be imported from server-side code
// (Server Components, Server Actions, API routes).
// It reads process.env vars that are NOT prefixed with NEXT_PUBLIC_
// and would be undefined in the browser.

/** Places API (New) hard cap for Nearby Search results */
const PLACES_API_MAX_RESULTS = 20;

/** Places API (New) absolute max radius in meters */
const PLACES_API_MAX_RADIUS = 50_000;

export const ANALYZER_CONFIG = {
  /**
   * Maximum number of places returned per Nearby Search request.
   * Capped at 20 (Places API hard limit).
   */
  maxResults: Math.min(
    parseInt(process.env.ANALYZER_MAX_RESULTS ?? "20", 10) || 20,
    PLACES_API_MAX_RESULTS
  ),

  /**
   * Maximum search radius in meters.
   * Default: 2500 m. Increase via env var if needed (up to 50 km).
   */
  maxRadiusMeters: Math.min(
    parseInt(process.env.ANALYZER_MAX_RADIUS_METERS ?? "2500", 10) || 2500,
    PLACES_API_MAX_RADIUS
  ),

  /**
   * Cache TTL in days. PlaceCache rows older than this are considered stale
   * and will trigger a fresh API call on next access.
   * Default: 7 days.
   */
  cacheTtlDays: parseInt(process.env.ANALYZER_CACHE_TTL_DAYS ?? "7", 10) || 7,
} as const;

/** Allowed radius values exposed in the UI select */
export const ANALYZER_RADIUS_OPTIONS = [
  { label: "500 m", value: 500 },
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
  { label: "2,5 km", value: 2500 },
] as const;

export type AnalyzerRadiusValue =
  (typeof ANALYZER_RADIUS_OPTIONS)[number]["value"];

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
