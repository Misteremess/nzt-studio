// features/proposal-builder/types.ts
// Types for the Proposal Builder module.
// Takes an MVP spec (from the MVP Factory) plus its pricing (from the Pricing
// Studio, if generated) and produces a complete, client-ready commercial
// proposal in Spanish.

import type { Complexity } from "@/features/mvp-factory/types";

/** A named phase of the project plan inside a proposal. */
export interface ProposalPhase {
  title: string;
  description: string;
}

/** The full proposal stored for an MVP spec. */
export interface ProposalData {
  id: string;
  mvpSpecId: string;
  model: string;
  title: string;
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  scope: string[];
  outOfScope: string[];
  deliverables: string[];
  phases: ProposalPhase[];
  terms: string[];
  nextSteps: string[];
  investment: string;
  callToAction: string;
  createdAt: string;
  updatedAt: string;
}

/** Raw, parsed shape returned by the Claude call (before persistence). */
export interface ProposalOutput {
  title: string;
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  scope: string[];
  outOfScope: string[];
  deliverables: string[];
  phases: ProposalPhase[];
  terms: string[];
  nextSteps: string[];
  investment: string;
  callToAction: string;
}

/** A single tier passed into the proposal context (mirrors pricing tiers). */
export interface ProposalPricingTier {
  name: string;
  price: number;
  billing: string;
  description: string;
  features: string[];
}

/** Pricing context handed to the AI, if the MVP has been priced. */
export interface ProposalPricingContext {
  currency: string;
  setupPrice: number;
  monthlyPrice: number | null;
  tiers: ProposalPricingTier[];
  recommendedTier: string | null;
  paymentTerms: string;
}

/** Context handed to the AI to write a proposal, sourced from spec + pricing. */
export interface ProposalInput {
  businessName: string;
  businessSummary: string;
  opportunityTitle: string;
  pitch: string;
  problem: string;
  solution: string;
  targetUser: string;
  coreFeatures: string[];
  futureFeatures: string[];
  techStack: string[];
  timeline: string;
  complexity: Complexity | null;
  pricing: ProposalPricingContext | null;
}

/** An MVP spec ready to be turned into a proposal, with its proposal if any. */
export interface ProposalItem {
  mvpSpecId: string;
  opportunityTitle: string;
  pitch: string;
  timeline: string;
  complexity: Complexity | null;
  hasPricing: boolean;
  proposal: ProposalData | null;
}

/** A business grouping its MVPs for the proposal inbox. */
export interface ProposalBusiness {
  placeId: string;
  businessName: string;
  summary: string;
  items: ProposalItem[];
}
