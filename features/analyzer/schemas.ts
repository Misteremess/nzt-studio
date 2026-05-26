// features/analyzer/schemas.ts
// Zod validation schemas for Analyzer Server Action inputs.
// Used by searchPlacesAction and fetchPlaceDetailAction (NZT-79).
//
// Safe to import from both server and client code:
// types are erased at runtime; schema objects are only used server-side.

import { z } from "zod";
import { ANALYZER_CATEGORIES } from "@/features/analyzer/lib/categories";

/** Valid Google Places type values from the predefined category list */
const VALID_PLACE_TYPES = ANALYZER_CATEGORIES.map((c) => c.placeType);

// ─── Search input ──────────────────────────────────────────────────────────────

/**
 * Input schema for searchPlacesAction.
 * Validated server-side before calling the Places API.
 */
export const searchInputSchema = z.object({
  /** Location to search around. Geocoded server-side to lat/lng. */
  locationText: z
    .string()
    .min(1, "Introduce una ubicación (ej. 'Madrid' o 'Calle Mayor, Barcelona')"),

  /**
   * Search radius in meters. Must be one of the allowed values.
   * Max enforced server-side by ANALYZER_CONFIG.maxRadiusMeters.
   */
  radiusMeters: z
    .number()
    .int("El radio debe ser un número entero")
    .min(100, "El radio mínimo es 100 metros")
    .max(2500, "El radio máximo es 2.500 metros"),

  /** Google Places includedTypes value. Must be a known category. */
  placeType: z
    .string()
    .min(1, "Selecciona una categoría de negocio")
    .refine(
      (v) => VALID_PLACE_TYPES.includes(v),
      { message: "Categoría de negocio no válida" }
    ),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

// ─── Detail input ──────────────────────────────────────────────────────────────

/**
 * Input schema for fetchPlaceDetailAction.
 */
export const fetchDetailInputSchema = z.object({
  /** Google Places ID from a previous search result. */
  placeId: z
    .string()
    .min(1, "El placeId no puede estar vacío"),
});

export type FetchDetailInput = z.infer<typeof fetchDetailInputSchema>;

// ─── Save as Company input ─────────────────────────────────────────────────────

/**
 * Input schema for saveAsCompanyAction (NZT-81).
 * Defined here for co-location with the other Analyzer schemas.
 */
export const saveAsCompanyInputSchema = z.object({
  placeId: z
    .string()
    .min(1, "El placeId no puede estar vacío"),
});

export type SaveAsCompanyInput = z.infer<typeof saveAsCompanyInputSchema>;
