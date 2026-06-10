// features/market-intelligence/types.ts
// Client-safe types for Market Intelligence — analytics about the market you've
// scanned and analyzed (sectors, ratings, opportunity themes, coverage).

export interface MiSlice {
  label: string;
  value: number;
  color?: string;
}

export interface MiBar {
  label: string;
  value: number;
  hint?: string;
}

export interface MiBusinessRow {
  placeId: string;
  businessName: string;
  sector: string;
  rating: number | null;
  reviews: number | null;
  opportunities: number;
  selected: number;
  status: string | null;
}

export interface MarketData {
  coverage: {
    discovered: number; // PlaceCache rows (businesses found by the Rastreador)
    analyzed: number; // BusinessAnalysis rows
    opportunities: number;
    avgOppsPerBusiness: number;
  };
  sectors: MiBar[]; // analyzed businesses by sector
  ratingDistribution: MiSlice[];
  impactDistribution: MiSlice[];
  effortDistribution: MiSlice[];
  themes: MiBar[]; // most common keywords across opportunity titles
  insight: {
    lowRatedShare: number; // % of analyzed businesses rated < 4.0
    lowRatedAvgOpps: number;
    highRatedAvgOpps: number;
  } | null;
  businesses: MiBusinessRow[];
  hasData: boolean;
}
