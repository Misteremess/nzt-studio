// features/analyzer/lib/opportunity-rules.ts
// Deterministic rule engine for generating initial business opportunities.
//
// Pure functions — no AI, no API calls, no Prisma, no process.env.
// Safe to import from both server and client code.

import type {
  PlaceDetail,
  PlaceSignals,
  DetectedOpportunity,
} from "@/features/rastreador/types";
import { computeSignals } from "@/features/rastreador/lib/place-signals";

// ─── Category groups ──────────────────────────────────────────────────────────

/**
 * Google Places types where appointment/reservation booking is the norm.
 * Used to trigger the booking-system opportunity rule.
 */
const BOOKING_TYPES = new Set([
  "dentist",
  "physiotherapist",
  "barber_shop",
  "hair_salon",
  "beauty_salon",
  "veterinary_care",
  "gym",
  "fitness_center",
  "school",
  "spa",
]);

/**
 * Google Places types where a digital menu, catalog, or order form adds value.
 * Used to trigger the catalog/orders opportunity rule.
 */
const CATALOG_TYPES = new Set([
  "bakery",
  "pastry_shop",
  "restaurant",
  "cafe",
  "coffee_shop",
  "bar",
  "ice_cream_shop",
  "food",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function opp(
  id: string,
  data: Omit<DetectedOpportunity, "id">
): DetectedOpportunity {
  return { id, ...data };
}

function matchesAnyType(types: string[], group: Set<string>): boolean {
  return types.some((t) => group.has(t));
}

// ─── Rule engine ──────────────────────────────────────────────────────────────

/**
 * Evaluates deterministic rules against a PlaceDetail and its computed signals.
 * Returns detected opportunities ordered by priority (high → medium → low).
 *
 * Design rules:
 * - All `reason` strings reference actual data from the business (name, rating,
 *   review count). Nothing is invented.
 * - Website-related rules (1a, 1b, 1c) are mutually exclusive — only the most
 *   specific one fires.
 * - Category rules (2, 3) and quality rules (4, 5) are independent.
 * - Permanently closed businesses return an empty list.
 */
export function detectOpportunities(
  detail: PlaceDetail,
  signals: PlaceSignals
): DetectedOpportunity[] {
  // No opportunities for permanently closed businesses
  if (signals.businessStatus === "CLOSED_PERMANENTLY") {
    return [];
  }

  const opportunities: DetectedOpportunity[] = [];
  const name  = detail.name;
  const types = detail.types;

  // ── Rule group 1: Website / digital presence (mutually exclusive) ─────────
  //
  // 1a. High reputation + no website — most specific, highest value
  //     Condition: highReputationNoWebsite
  //
  // 1b. Active business (has phone) + no website
  //     Condition: missingWebsite && hasPhone (and not 1a)
  //
  // 1c. Total absence (no website AND no phone)
  //     Condition: missingWebsite && missingPhone (and not 1a)
  //
  // Only one of 1a/1b/1c fires per business.

  if (signals.highReputationNoWebsite) {
    const rating  = detail.rating?.toFixed(1) ?? "alta";
    const reviews = signals.reviewCount;
    opportunities.push(
      opp("high_reputation_no_website", {
        title: "Web de conversión aprovechando reputación",
        reason:
          `${name} tiene un rating de ${rating} con ${reviews} reseñas en Google ` +
          `pero no tiene sitio web. Su reputación genera interés que se pierde por ` +
          `falta de presencia digital propia.`,
        suggestedMvp:
          "Web profesional orientada a conversión con sección de reseñas integradas, " +
          "llamadas a la acción claras y formulario de contacto o reserva.",
        priority: "high",
        estimatedValue: "high",
        confidence: "high",
        sourceSignals: ["highReputationNoWebsite", "highReputation", "missingWebsite"],
      })
    );
  } else if (signals.missingWebsite && signals.hasPhone) {
    // Active business reachable by phone but without web presence
    opportunities.push(
      opp("no_website", {
        title: "Web local / Landing corporativa",
        reason:
          `${name} no tiene sitio web registrado en Google Places. ` +
          `Es un negocio activo (tiene teléfono) sin presencia digital propia.`,
        suggestedMvp:
          "Landing page con información del negocio, mapa de ubicación, " +
          "servicios o carta, y formulario de contacto.",
        priority: "high",
        estimatedValue: "medium",
        confidence: "high",
        sourceSignals: ["missingWebsite", "localBusinessWithDigitalGap"],
      })
    );
  } else if (signals.missingWebsite && signals.missingPhone) {
    // Total digital absence — no web and no contact info on Google
    opportunities.push(
      opp("digital_gap", {
        title: "Presencia digital local completa",
        reason:
          `${name} no tiene sitio web ni teléfono registrado en Google Places. ` +
          `Su presencia digital es prácticamente nula, lo que limita fuertemente ` +
          `su visibilidad y captación de clientes.`,
        suggestedMvp:
          "Pack de presencia digital básica: web con datos de contacto, " +
          "optimización de ficha Google Business y activación de canales de contacto.",
        priority: "high",
        estimatedValue: "medium",
        confidence: "medium",
        sourceSignals: ["missingWebsite", "missingPhone"],
      })
    );
  }

  // ── Rule 2: Booking / appointment system (category-based) ─────────────────
  // Fires for service businesses where scheduling is the main friction point.
  // Independent of website rules — a business can have a web and still lack booking.
  if (matchesAnyType(types, BOOKING_TYPES)) {
    const typeLabel = signals.primaryType ?? "servicio";
    opportunities.push(
      opp("booking_system", {
        title: "Sistema de reservas / Cita online",
        reason:
          `${name} es un negocio de tipo "${typeLabel}" donde los clientes ` +
          `habitualmente necesitan concertar cita. La ausencia de reserva online ` +
          `genera fricción y pérdida de potenciales clientes.`,
        suggestedMvp:
          "Integración de cita online: Calendly, Google Calendar o formulario de cita " +
          "propio embebido en la web o enviado por WhatsApp.",
        priority: "medium",
        estimatedValue: "medium",
        confidence: "medium",
        sourceSignals: ["primaryType"],
      })
    );
  }

  // ── Rule 3: Digital catalog / order form (category-based) ─────────────────
  // Fires for food and retail businesses where browsing menu/products online adds value.
  if (matchesAnyType(types, CATALOG_TYPES)) {
    const typeLabel = signals.primaryType ?? "negocio";
    opportunities.push(
      opp("catalog_orders", {
        title: "Carta digital o formulario de encargos",
        reason:
          `${name} es un negocio de tipo "${typeLabel}" donde los clientes ` +
          `pueden querer consultar carta, hacer pedidos o encargar productos con antelación.`,
        suggestedMvp:
          "Carta o catálogo digital accesible desde móvil, con formulario de encargo " +
          "o pedido y WhatsApp como canal de cierre.",
        priority: "medium",
        estimatedValue: "medium",
        confidence: "medium",
        sourceSignals: ["primaryType"],
      })
    );
  }

  // ── Rule 4: Low review count (reputation gap) ──────────────────────────────
  // Fires for businesses with rating but very few reviews.
  // More reviews → better local SEO ranking → more clients.
  if (signals.lowReviewCount) {
    const reviews = signals.reviewCount;
    opportunities.push(
      opp("low_review_count", {
        title: "Captación de reseñas y reputación local",
        reason:
          `${name} solo tiene ${reviews} reseña${reviews !== 1 ? "s" : ""} en Google. ` +
          `Con tan pocas valoraciones, el negocio tiene baja visibilidad en búsquedas ` +
          `locales y genera poca confianza a nuevos clientes.`,
        suggestedMvp:
          "Sistema de solicitud de reseñas post-visita: QR en el local, " +
          "mensaje de WhatsApp automatizado o email de seguimiento.",
        priority: "low",
        estimatedValue: "low",
        confidence: "high",
        sourceSignals: ["lowReviewCount"],
      })
    );
  }

  // ── Rule 5: Missing phone / incomplete Google profile ──────────────────────
  // Fires when there is no phone registered on Google Places.
  // Incomplete profiles lower trust and reduce discoverability.
  if (signals.missingPhone) {
    opportunities.push(
      opp("missing_phone", {
        title: "Optimización de ficha Google y canales de contacto",
        reason:
          `${name} no tiene teléfono registrado en Google Places. ` +
          `Una ficha incompleta reduce la confianza de potenciales clientes ` +
          `y dificulta el contacto directo.`,
        suggestedMvp:
          "Auditoría y optimización de Google Business Profile: completar datos, " +
          "añadir fotos, horario y canales de contacto activos (teléfono, WhatsApp, web).",
        priority: "low",
        estimatedValue: "low",
        confidence: "medium",
        sourceSignals: ["missingPhone"],
      })
    );
  }

  return opportunities;
}

// ─── Combined entry point ─────────────────────────────────────────────────────

/**
 * Convenience function: computes signals AND detects opportunities in one call.
 * Used by Server Actions (NZT-79) and the cache update layer.
 */
export function computeSignalsAndOpportunities(detail: PlaceDetail): {
  signals: PlaceSignals;
  opportunities: DetectedOpportunity[];
} {
  const signals = computeSignals(detail);
  const opportunities = detectOpportunities(detail, signals);
  return { signals, opportunities };
}
