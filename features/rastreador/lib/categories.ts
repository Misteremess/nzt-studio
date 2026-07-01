// features/analyzer/lib/categories.ts
// Predefined business categories for the Local Business Analyzer.
// Each entry maps a visible label to a Google Places API includedTypes value
// (must be a valid "Table A" type — see
// https://developers.google.com/maps/documentation/places/web-service/place-types)
// and a Company.sector label used when saving as a CRM candidate.
//
// Safe to import from both server and client code (no process.env, no Prisma).

import type { AnalyzerCategory } from "@/features/rastreador/types";

/**
 * Sentinel placeType for the "Otros" category.
 * Not a real Google Places type — searchNearby omits includedTypes entirely
 * when this value is selected, returning businesses of any type nearby.
 */
export const OTHER_PLACE_TYPE = "other";

export const ANALYZER_CATEGORIES: AnalyzerCategory[] = [
  {
    label: "Todos los negocios (sin filtro)",
    icon: "🌐",
    placeType: OTHER_PLACE_TYPE,
    sectorLabel: "Otro",
    opportunityHints: [
      "Web profesional con servicios",
      "Presencia en Google Business",
      "Canal de contacto digital (WhatsApp, formulario)",
    ],
  },
  {
    label: "Panadería / Pastelería",
    icon: "🥐",
    placeType: "bakery",
    // Híbridos frecuentes: pastelería-cafetería, obrador con degustación, etc.
    searchTypes: [
      "bakery",
      "cafe",
      "coffee_shop",
      "dessert_shop",
      "dessert_restaurant",
      "donut_shop",
      "chocolate_shop",
      "candy_store",
    ],
    sectorLabel: "Alimentación",
    opportunityHints: [
      "Web con carta y encargos",
      "Formulario de pedido online",
      "Reserva de productos especiales",
    ],
  },
  {
    label: "Restaurante",
    icon: "🍽️",
    placeType: "restaurant",
    searchTypes: [
      "restaurant",
      "meal_takeaway",
      "meal_delivery",
      "diner",
      "fast_food_restaurant",
      "brunch_restaurant",
      "breakfast_restaurant",
    ],
    sectorLabel: "Hostelería",
    opportunityHints: [
      "Carta digital actualizable",
      "Reservas online",
      "Menú del día",
    ],
  },
  {
    label: "Cafetería",
    icon: "☕",
    placeType: "cafe",
    searchTypes: [
      "cafe",
      "coffee_shop",
      "bakery",
      "tea_house",
      "breakfast_restaurant",
      "dessert_shop",
    ],
    sectorLabel: "Hostelería",
    opportunityHints: [
      "Carta o menú digital",
      "Presencia local",
      "Fidelización de clientes",
    ],
  },
  {
    label: "Bar / Pub",
    icon: "🍺",
    placeType: "bar",
    searchTypes: ["bar", "pub", "wine_bar", "bar_and_grill"],
    sectorLabel: "Hostelería",
    opportunityHints: [
      "Carta digital con QR",
      "Eventos y promociones",
      "Presencia en redes sociales",
    ],
  },
  {
    label: "Heladería",
    icon: "🍦",
    placeType: "ice_cream_shop",
    searchTypes: ["ice_cream_shop", "dessert_shop", "cafe"],
    sectorLabel: "Hostelería",
    opportunityHints: [
      "Carta digital de sabores",
      "Pedidos para llevar online",
    ],
  },
  {
    label: "Hotel / Alojamiento",
    icon: "🏨",
    placeType: "hotel",
    sectorLabel: "Turismo y alojamiento",
    opportunityHints: [
      "Reservas online directas",
      "Web con galería y servicios",
      "Gestión de reseñas",
    ],
  },
  {
    label: "Agencia de viajes",
    icon: "🧳",
    placeType: "travel_agency",
    sectorLabel: "Turismo y alojamiento",
    opportunityHints: [
      "Catálogo de destinos online",
      "Formulario de presupuesto",
    ],
  },
  {
    label: "Barbería",
    icon: "✂️",
    placeType: "barber_shop",
    sectorLabel: "Estética y cuidado personal",
    opportunityHints: [
      "Reservas online",
      "Galería de trabajos",
      "Presencia en Google Business",
    ],
  },
  {
    label: "Peluquería",
    icon: "💇",
    placeType: "hair_salon",
    sectorLabel: "Estética y cuidado personal",
    opportunityHints: [
      "Reservas online",
      "Catálogo de servicios y precios",
    ],
  },
  {
    label: "Centro de estética",
    icon: "💅",
    placeType: "beauty_salon",
    sectorLabel: "Estética y cuidado personal",
    opportunityHints: [
      "Reservas online",
      "Galería antes/después",
      "Catálogo de servicios y precios",
    ],
  },
  {
    label: "Spa / Bienestar",
    icon: "🧖",
    placeType: "spa",
    sectorLabel: "Estética y cuidado personal",
    opportunityHints: [
      "Reservas online",
      "Bonos y packs digitales",
    ],
  },
  {
    label: "Clínica dental",
    icon: "🦷",
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
    icon: "🩺",
    placeType: "physiotherapist",
    sectorLabel: "Salud",
    opportunityHints: [
      "Cita online",
      "Blog de contenido",
      "Optimización de ficha Google",
    ],
  },
  {
    label: "Farmacia",
    icon: "💊",
    placeType: "pharmacy",
    sectorLabel: "Salud",
    opportunityHints: [
      "Web con horarios y servicios",
      "Pedido de recetas online",
    ],
  },
  {
    label: "Veterinario",
    icon: "🐾",
    placeType: "veterinary_care",
    sectorLabel: "Veterinaria",
    opportunityHints: [
      "Cita online",
      "Historial de mascotas",
      "Recordatorios de vacunas",
    ],
  },
  {
    label: "Gimnasio",
    icon: "🏋️",
    placeType: "gym",
    sectorLabel: "Deporte y bienestar",
    opportunityHints: [
      "Web con tarifas y horarios",
      "Área privada de clientes",
    ],
  },
  {
    label: "Academia / Centro educativo",
    icon: "📚",
    placeType: "school",
    sectorLabel: "Educación",
    opportunityHints: [
      "Web con cursos e inscripción online",
      "Campus virtual básico",
    ],
  },
  {
    label: "Inmobiliaria",
    icon: "🏠",
    placeType: "real_estate_agency",
    sectorLabel: "Inmobiliaria",
    opportunityHints: [
      "Portal de propiedades",
      "Captación de leads",
      "CRM integrado",
    ],
  },
  {
    label: "Abogado / Gestoría",
    icon: "⚖️",
    placeType: "lawyer",
    sectorLabel: "Servicios legales y fiscales",
    opportunityHints: [
      "Web profesional",
      "Cita previa online",
      "Blog jurídico o fiscal",
    ],
  },
  {
    label: "Asesoría / Contabilidad",
    icon: "🧾",
    placeType: "accounting",
    sectorLabel: "Servicios legales y fiscales",
    opportunityHints: [
      "Web profesional con servicios",
      "Portal de clientes",
    ],
  },
  {
    label: "Seguros",
    icon: "🛡️",
    placeType: "insurance_agency",
    sectorLabel: "Servicios financieros",
    opportunityHints: [
      "Web con cotizador online",
      "Captación de leads",
    ],
  },
  {
    label: "Taller mecánico",
    icon: "🔧",
    placeType: "car_repair",
    sectorLabel: "Automoción",
    opportunityHints: [
      "Web con servicios y precios",
      "Formulario de presupuesto online",
      "WhatsApp Business",
    ],
  },
  {
    label: "Concesionario de coches",
    icon: "🚗",
    placeType: "car_dealer",
    sectorLabel: "Automoción",
    opportunityHints: [
      "Catálogo de vehículos online",
      "Formulario de financiación",
    ],
  },
  {
    label: "Lavado de coches",
    icon: "🧼",
    placeType: "car_wash",
    sectorLabel: "Automoción",
    opportunityHints: [
      "Web con tarifas y bonos",
      "Reserva de turno online",
    ],
  },
  {
    label: "Gasolinera",
    icon: "⛽",
    placeType: "gas_station",
    sectorLabel: "Automoción",
    opportunityHints: [
      "Ficha Google completa",
      "Servicios adicionales destacados",
    ],
  },
  {
    label: "Electricista",
    icon: "💡",
    placeType: "electrician",
    sectorLabel: "Construcción y reformas",
    opportunityHints: [
      "Web con servicios y zona de cobertura",
      "Formulario de presupuesto online",
      "WhatsApp Business",
    ],
  },
  {
    label: "Fontanero",
    icon: "🔩",
    placeType: "plumber",
    sectorLabel: "Construcción y reformas",
    opportunityHints: [
      "Web con servicios urgentes 24h",
      "Formulario de presupuesto online",
    ],
  },
  {
    label: "Pintor",
    icon: "🎨",
    placeType: "painter",
    sectorLabel: "Construcción y reformas",
    opportunityHints: [
      "Portfolio de trabajos",
      "Formulario de presupuesto online",
    ],
  },
  {
    label: "Tejados y cubiertas",
    icon: "🏗️",
    placeType: "roofing_contractor",
    sectorLabel: "Construcción y reformas",
    opportunityHints: [
      "Portfolio de proyectos",
      "Formulario de presupuesto",
    ],
  },
  {
    label: "Cerrajería",
    icon: "🔑",
    placeType: "locksmith",
    sectorLabel: "Servicios",
    opportunityHints: [
      "Web con servicio urgente 24h",
      "WhatsApp Business",
    ],
  },
  {
    label: "Lavandería / Tintorería",
    icon: "🧺",
    placeType: "laundry",
    sectorLabel: "Servicios",
    opportunityHints: [
      "Web con tarifas y horarios",
      "Recogida y entrega a domicilio online",
    ],
  },
  {
    label: "Funeraria",
    icon: "🕊️",
    placeType: "funeral_home",
    sectorLabel: "Servicios",
    opportunityHints: [
      "Web con información de servicios",
      "Atención y contacto 24h",
    ],
  },
  {
    label: "Tienda de ropa",
    icon: "👗",
    placeType: "clothing_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online",
      "Tienda online / e-commerce",
    ],
  },
  {
    label: "Zapatería",
    icon: "👟",
    placeType: "shoe_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online",
      "Tienda online / e-commerce",
    ],
  },
  {
    label: "Joyería",
    icon: "💍",
    placeType: "jewelry_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online con fotos",
      "Tienda online / e-commerce",
    ],
  },
  {
    label: "Librería",
    icon: "📖",
    placeType: "book_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo y reservas online",
      "Eventos y club de lectura",
    ],
  },
  {
    label: "Tienda de electrónica",
    icon: "🔌",
    placeType: "electronics_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online con precios",
      "Servicio técnico y reparaciones",
    ],
  },
  {
    label: "Ferretería",
    icon: "🛠️",
    placeType: "hardware_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online",
      "Pedido y recogida en tienda",
    ],
  },
  {
    label: "Mueble y hogar",
    icon: "🛋️",
    placeType: "furniture_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online con fotos",
      "Tienda online / e-commerce",
    ],
  },
  {
    label: "Floristería",
    icon: "💐",
    placeType: "florist",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Pedido online con entrega",
      "Catálogo de ramos y ocasiones",
    ],
  },
  {
    label: "Tienda de mascotas",
    icon: "🐶",
    placeType: "pet_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online",
      "Pedido y recogida en tienda",
    ],
  },
  {
    label: "Tienda de bicicletas",
    icon: "🚲",
    placeType: "bicycle_store",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Catálogo online",
      "Reserva de taller / reparaciones",
    ],
  },
  {
    label: "Supermercado",
    icon: "🛒",
    placeType: "supermarket",
    sectorLabel: "Comercio",
    opportunityHints: [
      "Ficha Google completa con horarios",
      "Pedido online / a domicilio",
    ],
  },
];

/** Find a category by its Google Places type value */
export function getCategoryByType(placeType: string): AnalyzerCategory | undefined {
  return ANALYZER_CATEGORIES.find((c) => c.placeType === placeType);
}

/**
 * Resolves the list of Google Places `includedTypes` to send to the API for a
 * given category placeType. Returns an empty array for "Todos los negocios",
 * which the caller translates into an unfiltered (all-types) search.
 */
export function resolveSearchTypes(placeType: string): string[] {
  if (placeType === OTHER_PLACE_TYPE) return [];
  const category = getCategoryByType(placeType);
  if (!category) return [placeType];
  return category.searchTypes ?? [category.placeType];
}

/** Returns the visible label for a placeType, or the raw type as fallback */
export function getCategoryLabel(placeType: string): string {
  return getCategoryByType(placeType)?.label ?? placeType;
}

/**
 * True if a business (by its Google `types`) belongs to the given category.
 * Used for client-side map/list filtering. "Todos los negocios" matches all.
 */
export function placeMatchesCategory(placeTypes: string[], categoryType: string): boolean {
  if (categoryType === OTHER_PLACE_TYPE) return true;
  const wanted = new Set(resolveSearchTypes(categoryType));
  return placeTypes.some((t) => wanted.has(t));
}

/** Returns the Company.sector label for a placeType */
export function getSectorLabel(placeType: string): string {
  return getCategoryByType(placeType)?.sectorLabel ?? "Otro";
}
