// features/analyzer/lib/categories.ts
// Predefined business categories for the Local Business Analyzer.
// Each entry maps a visible label to a Google Places API includedTypes value
// and a Company.sector label used when saving as a CRM candidate.
//
// Safe to import from both server and client code (no process.env, no Prisma).

import type { AnalyzerCategory } from "@/features/analyzer/types";

export const ANALYZER_CATEGORIES: AnalyzerCategory[] = [
  {
    label: "Panadería / Pastelería",
    placeType: "bakery",
    sectorLabel: "Alimentación",
    opportunityHints: [
      "Web con carta y encargos",
      "Formulario de pedido online",
      "Reserva de productos especiales",
    ],
  },
  {
    label: "Barbería",
    placeType: "barber_shop",
    sectorLabel: "Estética y cuidado personal",
    opportunityHints: [
      "Reservas online",
      "Galería de trabajos",
      "Presencia en Google Business",
    ],
  },
  {
    label: "Clínica dental",
    placeType: "dentist",
    sectorLabel: "Salud",
    opportunityHints: [
      "Web profesional con servicios",
      "Cita online",
      "SEO local",
    ],
  },
  {
    label: "Fisioterapia",
    placeType: "physiotherapist",
    sectorLabel: "Salud",
    opportunityHints: [
      "Cita online",
      "Blog de contenido",
      "Optimización de ficha Google",
    ],
  },
  {
    label: "Restaurante",
    placeType: "restaurant",
    sectorLabel: "Hostelería",
    opportunityHints: [
      "Carta digital actualizable",
      "Reservas online",
      "Menú del día",
    ],
  },
  {
    label: "Cafetería",
    placeType: "cafe",
    sectorLabel: "Hostelería",
    opportunityHints: [
      "Carta o menú digital",
      "Presencia local",
      "Fidelización de clientes",
    ],
  },
  {
    label: "Taller mecánico",
    placeType: "car_repair",
    sectorLabel: "Automoción",
    opportunityHints: [
      "Web con servicios y precios",
      "Formulario de presupuesto online",
      "WhatsApp Business",
    ],
  },
  {
    label: "Academia / Clases",
    placeType: "tutoring_center",
    sectorLabel: "Educación",
    opportunityHints: [
      "Web con cursos e inscripción online",
      "Campus virtual básico",
    ],
  },
  {
    label: "Inmobiliaria",
    placeType: "real_estate_agency",
    sectorLabel: "Inmobiliaria",
    opportunityHints: [
      "Portal de propiedades",
      "Captación de leads",
      "CRM integrado",
    ],
  },
  {
    label: "Centro de estética",
    placeType: "beauty_salon",
    sectorLabel: "Estética y cuidado personal",
    opportunityHints: [
      "Reservas online",
      "Galería antes/después",
      "Catálogo de servicios y precios",
    ],
  },
  {
    label: "Gimnasio",
    placeType: "gym",
    sectorLabel: "Deporte y bienestar",
    opportunityHints: [
      "Web con tarifas y horarios",
      "Área privada de clientes",
    ],
  },
  {
    label: "Reformas / Construcción",
    placeType: "general_contractor",
    sectorLabel: "Construcción y reformas",
    opportunityHints: [
      "Portfolio de proyectos",
      "Formulario de presupuesto",
      "Catálogo de trabajos",
    ],
  },
  {
    label: "Abogado / Gestoría",
    placeType: "lawyer",
    sectorLabel: "Servicios legales y fiscales",
    opportunityHints: [
      "Web profesional",
      "Cita previa online",
      "Blog jurídico o fiscal",
    ],
  },
  {
    label: "Veterinario",
    placeType: "veterinary_care",
    sectorLabel: "Veterinaria",
    opportunityHints: [
      "Cita online",
      "Historial de mascotas",
      "Recordatorios de vacunas",
    ],
  },
];

/** Find a category by its Google Places type value */
export function getCategoryByType(placeType: string): AnalyzerCategory | undefined {
  return ANALYZER_CATEGORIES.find((c) => c.placeType === placeType);
}

/** Returns the visible label for a placeType, or the raw type as fallback */
export function getCategoryLabel(placeType: string): string {
  return getCategoryByType(placeType)?.label ?? placeType;
}

/** Returns the Company.sector label for a placeType */
export function getSectorLabel(placeType: string): string {
  return getCategoryByType(placeType)?.sectorLabel ?? "Otro";
}
