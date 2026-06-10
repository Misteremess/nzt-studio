// features/analyzer/lib/constants.ts
// UI-safe constants for the Local Business Analyzer.
// No process.env access — safe to import from both server and client code.

/** Allowed radius values exposed in the UI select */
export const ANALYZER_RADIUS_OPTIONS = [
  { label: "500 m",  value: 500 },
  { label: "1 km",   value: 1000 },
  { label: "2 km",   value: 2000 },
  { label: "2,5 km", value: 2500 },
  { label: "5 km",   value: 5000 },
  { label: "10 km",  value: 10000 },
] as const;

export type AnalyzerRadiusValue =
  (typeof ANALYZER_RADIUS_OPTIONS)[number]["value"];
