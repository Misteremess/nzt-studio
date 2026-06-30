// features/home/lib/suggestions.ts
// Server-only: rule-based "what to do today" suggestions, computed live from
// the current pipeline state (no AI cost — naturally fresh on every load).
import "server-only";

import { prisma } from "@/db/prisma";
import type { HomeSuggestion } from "@/features/home/types";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const activeAnalysis = { archivedAt: null };
const activeOpp = { analysis: activeAnalysis };
const activeSpec = { archivedAt: null, opportunity: activeOpp };

/** Computes the prioritized list of "today" suggestion cards. */
export async function getDailySuggestions(): Promise<HomeSuggestion[]> {
  const staleBefore = new Date(Date.now() - FOURTEEN_DAYS_MS);

  const [
    selectedWithoutSpec,
    specsWithoutPricing,
    pricedWithoutProposal,
    stalePropsects,
    analyzedPlaceIds,
    totalPlaces,
  ] = await Promise.all([
    prisma.aiOpportunity.count({
      where: { selected: true, ...activeOpp, mvpSpec: null },
    }),
    prisma.aiMvpSpec.count({
      where: { ...activeSpec, pricing: null },
    }),
    prisma.aiMvpSpec.count({
      where: { ...activeSpec, pricing: { isNot: null }, proposal: null },
    }),
    prisma.company.count({
      where: {
        status: "PROSPECT",
        OR: [{ lastContactAt: null }, { lastContactAt: { lt: staleBefore } }],
      },
    }),
    prisma.businessAnalysis.findMany({ where: activeAnalysis, select: { placeId: true } }),
    prisma.placeCache.count(),
  ]);

  const undiscoveredPlaces = Math.max(
    0,
    totalPlaces - new Set(analyzedPlaceIds.map((a) => a.placeId)).size
  );

  const suggestions: HomeSuggestion[] = [];

  if (selectedWithoutSpec > 0) {
    suggestions.push({
      id: "specs-pending",
      title: "Genera los MVP pendientes",
      description: `${selectedWithoutSpec} oportunidad${selectedWithoutSpec === 1 ? "" : "es"} seleccionada${selectedWithoutSpec === 1 ? "" : "s"} sin especificación de MVP.`,
      href: "/mvp-factory",
      icon: "Rocket",
      count: selectedWithoutSpec,
    });
  }

  if (specsWithoutPricing > 0) {
    suggestions.push({
      id: "pricing-pending",
      title: "Pon precio a tus MVPs",
      description: `${specsWithoutPricing} MVP${specsWithoutPricing === 1 ? "" : "s"} listo${specsWithoutPricing === 1 ? "" : "s"} sin calcular precio.`,
      href: "/pricing-studio",
      icon: "Calculator",
      count: specsWithoutPricing,
    });
  }

  if (pricedWithoutProposal > 0) {
    suggestions.push({
      id: "proposals-pending",
      title: "Redacta las propuestas",
      description: `${pricedWithoutProposal} MVP${pricedWithoutProposal === 1 ? "" : "s"} con precio pero sin propuesta comercial.`,
      href: "/proposal-builder",
      icon: "FileText",
      count: pricedWithoutProposal,
    });
  }

  if (stalePropsects > 0) {
    suggestions.push({
      id: "stale-prospects",
      title: "Retoma el contacto con prospectos",
      description: `${stalePropsects} prospecto${stalePropsects === 1 ? "" : "s"} sin seguimiento en los últimos 14 días.`,
      href: "/companies/pipeline",
      icon: "Users",
      count: stalePropsects,
    });
  }

  if (undiscoveredPlaces > 0) {
    suggestions.push({
      id: "places-unanalyzed",
      title: "Analiza nuevos negocios descubiertos",
      description: `${undiscoveredPlaces} negocio${undiscoveredPlaces === 1 ? "" : "s"} encontrado${undiscoveredPlaces === 1 ? "" : "s"} por el Rastreador sin analizar.`,
      href: "/rastreador",
      icon: "Radar",
      count: undiscoveredPlaces,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "all-caught-up",
      title: "Todo al día",
      description: "No hay acciones pendientes en el pipeline. Buen momento para buscar nuevas oportunidades.",
      href: "/rastreador",
      icon: "Lightbulb",
      count: 0,
    });
  }

  return suggestions.sort((a, b) => b.count - a.count).slice(0, 5);
}
