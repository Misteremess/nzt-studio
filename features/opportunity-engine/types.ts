// features/opportunity-engine/types.ts
// Client-safe types for the Opportunity Engine — the central, cross-business
// board of every AI-detected opportunity, ranked by priority.

import type { OppLevel } from "@/features/analyzer/types";

export type { OppLevel };

/** Impact × effort quadrant used to triage opportunities. */
export type OppQuadrant = "quick-win" | "big-bet" | "fill-in" | "thankless" | "unrated";

/** A single opportunity enriched with its business + downstream pipeline state. */
export interface EngineOpportunity {
  id: string;
  title: string;
  description: string;
  development: string;
  impact: OppLevel | null;
  effort: OppLevel | null;
  /** Marked for the MVP Factory. */
  selected: boolean;
  /** Downstream pipeline progress. */
  hasSpec: boolean;
  hasPricing: boolean;
  hasProposal: boolean;
  /** Business context. */
  placeId: string;
  businessName: string;
  analysisSummary: string;
  createdAt: string;
  /** Derived priority score (0-100, higher = better bet). */
  score: number;
  quadrant: OppQuadrant;
}

export interface EngineStats {
  total: number;
  selected: number;
  withSpec: number;
  quickWins: number;
  pending: number;
}

export interface EngineBusinessRef {
  placeId: string;
  businessName: string;
  count: number;
}

export interface EngineData {
  opportunities: EngineOpportunity[];
  stats: EngineStats;
  businesses: EngineBusinessRef[];
}
