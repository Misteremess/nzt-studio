// features/analyzer/types.ts
// Types for the AI Business Analyzer module.
// This module takes a business discovered via the Rastreador (Google Places)
// and asks Claude — with live web research — to analyze it: what the business
// already has, plus concrete growth opportunities to feed the MVP Factory.

export type OppLevel = "low" | "medium" | "high";

export interface WebSource {
  title: string;
  url: string;
}

/** A single opportunity proposed by the AI. */
export interface AiOpportunityData {
  id: string;
  title: string;
  description: string; // Qué es la oportunidad
  development: string; // "Qué podríamos hacer" — desarrollo concreto
  impact: OppLevel | null;
  effort: OppLevel | null;
  selected: boolean; // Marcada para pasar al MVP Factory
}

/** The full AI analysis of a business. */
export interface BusinessAnalysisData {
  id: string;
  placeId: string;
  businessName: string;
  model: string;
  summary: string;
  assets: string[]; // Lo que el negocio ya tiene
  webFindings: { text: string; sources: WebSource[] };
  opportunities: AiOpportunityData[];
  createdAt: string;
  updatedAt: string;
}

/** Compact analysis summary for the Analyzer landing listing. */
export interface AnalysisListItem {
  placeId: string;
  businessName: string;
  summary: string;
  opportunityCount: number;
  selectedCount: number;
  updatedAt: string;
  archivedAt: string | null;
}

/** Raw, parsed shape returned by the Claude call (before persistence). */
export interface AiAnalysisOutput {
  summary: string;
  assets: string[];
  webFindings: { text: string; sources: WebSource[] };
  opportunities: Array<{
    title: string;
    description: string;
    development: string;
    impact: OppLevel | null;
    effort: OppLevel | null;
  }>;
}

/** Minimal business context handed to the AI, sourced from PlaceCache. */
export interface BusinessContext {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  primaryType: string | null;
  types: string[];
  businessStatus: string | null;
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  nationalPhone: string | null;
  googleMapsUri: string | null;
  hasOpeningHours: boolean;
  openingHoursDescriptions: string[];
}
