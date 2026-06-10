// features/rastreador/lib/score.ts
// Score NZT: potencial comercial de un negocio según sus oportunidades
// detectadas. Compartido entre el panel de detalle y el informe imprimible.
// Client-safe: función pura, sin dependencias de entorno.

import type {
  DetectedOpportunity,
  OpportunityPriority,
} from "@/features/rastreador/types";

/** Techo práctico: 3 oportunidades de prioridad alta */
export const SCORE_MAX = 9;

const PRIORITY_WEIGHT: Record<OpportunityPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function computeScore(opportunities: DetectedOpportunity[]): number {
  return opportunities.reduce((sum, o) => sum + PRIORITY_WEIGHT[o.priority], 0);
}

export function scoreLabel(score: number): string {
  if (score === 0) return "Sin potencial detectado";
  if (score <= 2) return "Potencial bajo";
  if (score <= 5) return "Potencial medio";
  return "Potencial alto";
}
