// features/pricing-studio/types.ts
// Types for the Pricing Studio module.
// Takes the MVP specs generated in the MVP Factory and produces a concrete,
// sellable price for each: build cost, optional monthly maintenance, and a set
// of plans/tiers — all in EUR, aimed at local SMB clients.

import type { Complexity } from "@/features/mvp-factory/types";

/** A single pricing plan/tier offered to the client. */
export interface PricingTier {
  name: string;
  price: number;
  /** "one-time" | "monthly" — kept as string for flexibility. */
  billing: string;
  description: string;
  features: string[];
}

/**
 * SaaS perspective: the same MVP sold as a recurring monthly subscription
 * instead of a one-time build. Bundles build + hosting + support into a fee.
 */
export interface SaasModel {
  /** Recurring monthly subscription price (EUR). */
  monthlyPrice: number;
  /** Optional discounted annual price (EUR), or null. */
  annualPrice: number | null;
  /** Optional reduced onboarding/setup fee under the subscription, or null. */
  setupFee: number | null;
  /** Minimum commitment in months, or null. */
  minimumTermMonths: number | null;
  /** What the recurring fee includes (hosting, soporte, mejoras, etc.). */
  includedServices: string[];
  /** Months for the subscription revenue to match the one-time build price. */
  breakEvenMonths: number | null;
  /** Why a subscription works (or not) for this business. */
  rationale: string;
}

/** The full pricing stored for an MVP spec. */
export interface PricingData {
  id: string;
  mvpSpecId: string;
  model: string;
  currency: string;
  setupPrice: number;
  monthlyPrice: number | null;
  tiers: PricingTier[];
  recommendedTier: string | null;
  paymentTerms: string;
  rationale: string;
  assumptions: string[];
  saasModel: SaasModel | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw, parsed shape returned by the Claude call (before persistence). */
export interface PricingOutput {
  currency: string;
  setupPrice: number;
  monthlyPrice: number | null;
  tiers: PricingTier[];
  recommendedTier: string | null;
  paymentTerms: string;
  rationale: string;
  assumptions: string[];
  saasModel: SaasModel | null;
}

/** Context handed to the AI to price an MVP, sourced from the spec + analysis. */
export interface PricingInput {
  businessName: string;
  businessSummary: string;
  pitch: string;
  solution: string;
  targetUser: string;
  coreFeatures: string[];
  techStack: string[];
  timeline: string;
  complexity: Complexity | null;
}

/** An MVP spec ready to be priced, with its pricing if generated. */
export interface PricingItem {
  mvpSpecId: string;
  opportunityTitle: string;
  pitch: string;
  timeline: string;
  complexity: Complexity | null;
  pricing: PricingData | null;
}

/** A business grouping its MVPs for the pricing inbox. */
export interface PricingBusiness {
  placeId: string;
  businessName: string;
  summary: string;
  items: PricingItem[];
}
