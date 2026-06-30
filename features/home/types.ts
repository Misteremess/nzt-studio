// features/home/types.ts
// Client-safe types for the Home landing page: daily sector news + actionable
// suggestions derived from the current pipeline state.

/** Broad topic tags used to color-code news items. */
export type HomeNewsCategory = "IA" | "Pymes" | "Herramientas" | "Tendencias";

export interface HomeNewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  category?: HomeNewsCategory;
}

export interface HomeNewsData {
  items: HomeNewsItem[];
  generatedAt: string | null; // ISO — when the cached batch was generated
  /** True if generation failed today and we're showing yesterday's cache (or nothing). */
  stale: boolean;
  /** Set if generation failed and there's nothing cached to fall back to. */
  error?: string;
}

/** Lucide icon names used by suggestion cards (kept as strings — client-safe). */
export type HomeSuggestionIcon =
  | "Lightbulb"
  | "Rocket"
  | "Calculator"
  | "FileText"
  | "Users"
  | "Radar";

export interface HomeSuggestion {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: HomeSuggestionIcon;
  count: number;
}

export interface HomeStats {
  companies: number;
  opportunities: number;
  activeDeliveries: number;
  proposals: number;
}

export interface HomeData {
  suggestions: HomeSuggestion[];
  stats: HomeStats;
}
