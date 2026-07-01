// features/analyzer/types.ts
// TypeScript types for the Local Business Analyzer module (Sprint 3).
// These types describe the Google Places API responses, computed signals,
// opportunity rules output, and UI state machine.

// ─── Base ─────────────────────────────────────────────────────────────────────

export interface PlaceLocation {
  latitude: number;
  longitude: number;
}

export type PlaceBusinessStatus =
  | "OPERATIONAL"
  | "CLOSED_TEMPORARILY"
  | "CLOSED_PERMANENTLY"
  | "UNKNOWN";

// ─── API response shapes ──────────────────────────────────────────────────────

/** Datos mínimos disponibles desde Nearby Search (sin llamada adicional) */
export interface PlaceSummary {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  location: PlaceLocation;
  types: string[];
  primaryType: string | null;
  businessStatus: PlaceBusinessStatus;
  rating: number | null;
  userRatingCount: number | null;
  /**
   * Score NZT (0-9) si este negocio ya fue analizado (PlaceCache.opportunities
   * disponible). null si todavía no se ha cargado su detalle.
   */
  score: number | null;
}

/** Datos completos tras Place Details (cargados bajo demanda) */
export interface PlaceDetail extends PlaceSummary {
  websiteUri: string | null;
  nationalPhone: string | null;
  internationalPhone: string | null;
  googleMapsUri: string | null;
  hasOpeningHours: boolean;
  openingHoursDescriptions: string[];
}

// ─── Signals ──────────────────────────────────────────────────────────────────

/**
 * Señales digitales calculadas a partir de datos de Place Details.
 * Ninguna señal requiere acceso al contenido de la web del negocio.
 * Si un dato no está disponible en Places, la señal derivada es false.
 */
export interface PlaceSignals {
  // Datos directos normalizados
  hasWebsite: boolean;
  hasPhone: boolean;
  hasGoogleMapsUri: boolean;
  hasAddress: boolean;
  hasRating: boolean;
  reviewCount: number;
  hasOpeningHours: boolean;
  businessStatus: PlaceBusinessStatus;
  primaryType: string | null;

  // Señales derivadas — no se inventan datos
  missingWebsite: boolean;              // !hasWebsite
  missingPhone: boolean;                // !hasPhone
  highReputation: boolean;              // rating >= 4.2 && reviewCount >= 20
  highReputationNoWebsite: boolean;     // highReputation && !hasWebsite
  lowReviewCount: boolean;              // hasRating && reviewCount < 10
  localBusinessWithDigitalGap: boolean; // !hasWebsite && hasPhone
  closedOrTemporary: boolean;           // businessStatus !== "OPERATIONAL"
}

// ─── Web audit ────────────────────────────────────────────────────────────────

export type WebAuditSeverity = "low" | "medium" | "high";

/** Problema concreto detectado en la web del negocio */
export interface WebAuditIssue {
  id: string;
  label: string;             // Título corto, e.g. "Sin certificado seguro (HTTPS)"
  detail: string;            // Explicación apta para enseñar al cliente
  severity: WebAuditSeverity;
}

/**
 * Resultado de auditar la web del negocio mediante un fetch directo al HTML.
 * Sin APIs externas ni scraping profundo: una sola petición HTTP y análisis
 * del documento recibido. Si la web no responde, reachable=false y score=0.
 */
export interface WebAuditResult {
  url: string;                  // URL auditada (normalizada con protocolo)
  finalUrl: string | null;      // URL final tras redirecciones (null si no respondió)
  reachable: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;

  // Checks individuales (false si no se pudo comprobar)
  usesHttps: boolean;           // La URL final sirve por HTTPS
  hasViewport: boolean;         // Meta viewport — adaptada a móvil
  title: string | null;         // Contenido de <title>
  hasMetaDescription: boolean;  // Meta description para SEO
  hasOgTags: boolean;           // Open Graph — vista previa al compartir
  hasAnalytics: boolean;        // Google Analytics / GTM / Pixel / similar
  hasContactForm: boolean;      // Al menos un <form> en la página
  copyrightYear: number | null; // Año detectado en el aviso de copyright

  issues: WebAuditIssue[];      // Problemas derivados de los checks
  score: number;                // 0-100 — 100 = sin problemas detectados
  auditedAt: string;            // ISO timestamp de la auditoría
}

// ─── Opportunity rules ────────────────────────────────────────────────────────

export type OpportunityPriority = "low" | "medium" | "high";
export type OpportunityValue = "low" | "medium" | "high";
export type OpportunityConfidence = "low" | "medium" | "high";

/**
 * Oportunidad detectada por el motor de reglas determinista.
 * Sin IA. Cada oportunidad explica de qué señal sale.
 */
export interface DetectedOpportunity {
  id: string;
  title: string;
  reason: string;            // Explicación con datos concretos del negocio
  suggestedMvp: string;
  priority: OpportunityPriority;
  estimatedValue: OpportunityValue;
  confidence: OpportunityConfidence;
  sourceSignals: string[];   // IDs de señales que activaron la regla
}

// ─── Analyzer config ──────────────────────────────────────────────────────────

/** Categoría de negocio disponible en el selector del Analyzer */
export interface AnalyzerCategory {
  label: string;              // Texto visible en el dropdown
  icon: string;               // Emoji representativo de la categoría
  placeType: string;          // Valor de includedTypes para Places API (New)
  sectorLabel: string;        // Mapea a Company.sector al guardar como candidata
  opportunityHints: string[]; // Oportunidades típicas para orientar al usuario
}

/** Input del formulario de búsqueda */
export interface AnalyzerSearchInput {
  locationText: string;                                 // Texto a geocodificar server-side
  coordinates?: { latitude: number; longitude: number }; // Alternativa: coordenadas directas
  radiusMeters: number;                                 // 500 | 1000 | 2000 | 2500
  placeType: string;                                    // AnalyzerCategory.placeType
}

// ─── Cache record ─────────────────────────────────────────────────────────────

/**
 * Representa una fila de PlaceCache tal como se recupera de la BD.
 * Los campos signals y opportunities se almacenan como Json en Prisma
 * y se parsean a sus tipos TypeScript en la capa de datos (NZT-79).
 */
export interface PlaceCacheRecord {
  id: string;
  placeId: string;
  source: string;
  name: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  types: string[];
  primaryType: string | null;
  businessStatus: string | null;
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  nationalPhone: string | null;
  internationalPhone: string | null;
  googleMapsUri: string | null;
  hasOpeningHours: boolean;
  openingHoursDescriptions: string[];
  signals: PlaceSignals | null;
  opportunities: DetectedOpportunity[] | null;
  searchFetchedAt: Date;
  detailFetchedAt: Date | null;
  companyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── UI state machine ─────────────────────────────────────────────────────────

export type AnalyzerUIState =
  | "idle"           // Sin búsqueda activa. Formulario visible.
  | "searching"      // Llamada a Nearby Search en curso.
  | "results"        // Resultados de búsqueda disponibles.
  | "no_results"     // Búsqueda completada, cero resultados.
  | "error_search"   // Error en la búsqueda (API, red, cuota).
  | "loading_detail" // Cargando detalle de un negocio seleccionado.
  | "detail_loaded"  // Detalle cargado. Panel visible con señales y oportunidades.
  | "error_detail"   // Error al cargar el detalle.
  | "saving"         // Guardando como Company candidata.
  | "saved"          // Guardado correctamente. Link a /companies/[id].
  | "already_saved"; // Ya existe como Company candidata en el CRM.
