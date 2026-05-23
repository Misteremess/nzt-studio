// lib/constants.ts
// Constantes globales de la aplicación.

export const APP_NAME = "NZT Studio";
export const APP_VERSION = "0.1.0";

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  companies: "/companies",
  marketIntelligence: "/market-intelligence",
  companyAnalyzer: "/company-analyzer",
  opportunityEngine: "/opportunity-engine",
  mvpFactory: "/mvp-factory",
  pricingStudio: "/pricing-studio",
  proposalBuilder: "/proposal-builder",
  deliveryWorkspace: "/delivery-workspace",
  knowledgeBase: "/knowledge-base",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];