// features/opportunity-engine/lib/scoring.ts
// Pure, client-safe helpers to rank and triage opportunities by impact × effort.

import type { OppLevel, OppQuadrant } from "@/features/opportunity-engine/types";

/** Impact weight: higher impact is better. Unknown sits mid-low. */
function impactWeight(level: OppLevel | null): number {
  switch (level) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 1.5;
  }
}

/** Effort ease: LOW effort is better (easier to ship). Unknown sits mid. */
function effortEase(level: OppLevel | null): number {
  switch (level) {
    case "low":
      return 3;
    case "medium":
      return 2;
    case "high":
      return 1;
    default:
      return 1.5;
  }
}

/**
 * Priority score 0-100: high impact + low effort scores highest.
 * (impactWeight × effortEase) / 9, where 9 is the max (3 × 3).
 */
export function priorityScore(impact: OppLevel | null, effort: OppLevel | null): number {
  const raw = impactWeight(impact) * effortEase(effort);
  return Math.round((raw / 9) * 100);
}

/** Classic 2×2 triage. "High impact" = high or medium; "high effort" = high. */
export function quadrantOf(impact: OppLevel | null, effort: OppLevel | null): OppQuadrant {
  if (impact === null && effort === null) return "unrated";
  const highImpact = impact === "high" || impact === "medium";
  const highEffort = effort === "high";
  if (highImpact && !highEffort) return "quick-win";
  if (highImpact && highEffort) return "big-bet";
  if (!highImpact && !highEffort) return "fill-in";
  return "thankless";
}

export interface QuadrantMeta {
  id: OppQuadrant;
  label: string;
  hint: string;
  /** Tailwind classes for the badge/chip. */
  badge: string;
}

export const QUADRANT_META: Record<OppQuadrant, QuadrantMeta> = {
  "quick-win": {
    id: "quick-win",
    label: "Quick win",
    hint: "Alto impacto, poco esfuerzo",
    badge: "border-emerald-500/30 text-emerald-400",
  },
  "big-bet": {
    id: "big-bet",
    label: "Gran apuesta",
    hint: "Alto impacto, mucho esfuerzo",
    badge: "border-indigo-500/30 text-indigo-400",
  },
  "fill-in": {
    id: "fill-in",
    label: "Relleno",
    hint: "Bajo impacto, poco esfuerzo",
    badge: "border-sky-500/30 text-sky-400",
  },
  thankless: {
    id: "thankless",
    label: "Ingrato",
    hint: "Bajo impacto, mucho esfuerzo",
    badge: "border-rose-500/30 text-rose-400",
  },
  unrated: {
    id: "unrated",
    label: "Sin valorar",
    hint: "Impacto y esfuerzo desconocidos",
    badge: "border-border text-muted-foreground",
  },
};
