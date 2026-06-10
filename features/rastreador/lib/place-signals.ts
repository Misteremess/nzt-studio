// features/analyzer/lib/place-signals.ts
// Computes digital presence signals from a PlaceDetail object.
//
// Pure function — no API calls, no Prisma, no process.env.
// Safe to import from both server and client code.

import type { PlaceDetail, PlaceSignals } from "@/features/rastreador/types";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Minimum rating (inclusive) to qualify as high reputation */
const HIGH_REPUTATION_MIN_RATING = 4.2;

/** Minimum review count (inclusive) to qualify as high reputation */
const HIGH_REPUTATION_MIN_REVIEWS = 20;

/** Maximum review count (exclusive) to trigger the low-review-count signal */
const LOW_REVIEW_COUNT_MAX = 10;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes all digital presence signals for a given PlaceDetail.
 *
 * Rules:
 * - All signals are derived exclusively from Google Places data.
 * - No web scraping, no external calls, no AI.
 * - If a Places field is null/missing, derived signals default to false.
 * - `hasPhone` is true if either nationalPhone or internationalPhone exists.
 */
export function computeSignals(detail: PlaceDetail): PlaceSignals {
  // ── Direct signals ────────────────────────────────────────────────────────
  const hasWebsite     = !!detail.websiteUri;
  const hasPhone       = !!(detail.nationalPhone ?? detail.internationalPhone);
  const hasGoogleMapsUri = !!detail.googleMapsUri;
  const hasAddress     = !!detail.formattedAddress;
  const hasRating      = detail.rating !== null;
  const reviewCount    = detail.userRatingCount ?? 0;
  const hasOpeningHours = detail.hasOpeningHours;
  const businessStatus  = detail.businessStatus;
  const primaryType     = detail.primaryType;

  // ── Derived signals ───────────────────────────────────────────────────────
  const missingWebsite = !hasWebsite;
  const missingPhone   = !hasPhone;

  // Business has ≥ HIGH_REPUTATION_MIN_REVIEWS reviews and rating ≥ HIGH_REPUTATION_MIN_RATING
  const highReputation =
    hasRating &&
    (detail.rating ?? 0) >= HIGH_REPUTATION_MIN_RATING &&
    reviewCount >= HIGH_REPUTATION_MIN_REVIEWS;

  // Strong reputation signal but no website to convert it
  const highReputationNoWebsite = highReputation && !hasWebsite;

  // Has some reviews but very few — reputation gap without web amplification
  // reviewCount > 0 guard: avoid false signal for businesses with 0 reviews (no rating)
  const lowReviewCount =
    hasRating && reviewCount > 0 && reviewCount < LOW_REVIEW_COUNT_MAX;

  // Active local business (has phone) but no web presence
  // Distinct from missingWebsite alone: confirms real business activity
  const localBusinessWithDigitalGap = !hasWebsite && hasPhone;

  // Not currently operational (temporarily or permanently closed)
  const closedOrTemporary = businessStatus !== "OPERATIONAL";

  return {
    hasWebsite,
    hasPhone,
    hasGoogleMapsUri,
    hasAddress,
    hasRating,
    reviewCount,
    hasOpeningHours,
    businessStatus,
    primaryType,
    missingWebsite,
    missingPhone,
    highReputation,
    highReputationNoWebsite,
    lowReviewCount,
    localBusinessWithDigitalGap,
    closedOrTemporary,
  };
}
