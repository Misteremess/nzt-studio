// features/competitor-radar/types.ts
// Types for the Competitor Radar module.
// Uses live web search to find nearby competitors and market gaps for an
// analyzed business from the Rastreador.

/** A nearby competitor identified via web search. */
export interface RadarCompetitor {
  name: string;
  website?: string;
  strengths: string[];
  weaknesses: string[];
}

/** A cited web source. */
export interface RadarSource {
  title: string;
  url: string;
}

/** A persisted competitor radar report. */
export interface CompetitorRadarReportData {
  id: string;
  placeId: string;
  businessName: string;
  model: string;
  competitors: RadarCompetitor[];
  gaps: string[];
  summary: string;
  sources: RadarSource[];
  createdAt: string;
  updatedAt: string;
}

/** A business eligible for a competitor radar report (already analyzed). */
export interface CompetitorRadarCandidate {
  placeId: string;
  businessName: string;
  primaryType: string | null;
  formattedAddress: string | null;
  summary: string;
  hasReport: boolean;
}

/** Input used to run the competitor radar. */
export interface CompetitorRadarInput {
  placeId: string;
  businessName: string;
  primaryType: string | null;
  formattedAddress: string | null;
  summary: string;
}

/** Raw output returned by the AI call. */
export interface CompetitorRadarOutput {
  competitors: RadarCompetitor[];
  gaps: string[];
  summary: string;
}
