// features/content-seo/types.ts
// Types for the Content/SEO Agent module.
// Generates a content plan (post ideas) and a landing page copy draft for an
// analyzed business, informed by the web audit findings from the Rastreador.

/** A content/post idea. */
export interface ContentTopic {
  title: string;
  angle: string;
  keywords: string[];
  format: string;
}

/** Draft landing page copy. */
export interface LandingCopy {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  bullets: string[];
}

/** A persisted content plan. */
export interface ContentPlanData {
  id: string;
  placeId: string;
  businessName: string;
  model: string;
  topics: ContentTopic[];
  landingCopy: LandingCopy;
  seoNotes: string[];
  createdAt: string;
  updatedAt: string;
}

/** A business eligible for a content plan (already analyzed). */
export interface ContentPlanCandidate {
  placeId: string;
  businessName: string;
  primaryType: string | null;
  summary: string;
  seoIssues: string[];
  hasPlan: boolean;
}

/** Input used to generate a content plan. */
export interface ContentPlanInput {
  placeId: string;
  businessName: string;
  primaryType: string | null;
  summary: string;
  seoIssues: string[];
}

/** Raw output returned by the AI call. */
export interface ContentPlanOutput {
  topics: ContentTopic[];
  landingCopy: LandingCopy;
  seoNotes: string[];
}

// ─── SEO Audit (URL-based) ──────────────────────────────────────────────────

/** A finding inside one SEO audit category (technical, on-page, content, performance...). */
export interface SeoFinding {
  title: string;
  status: "ok" | "warning" | "critical";
  description: string;
  recommendation: string;
}

/** A category of the elaborate AI SEO report, with its own score and findings. */
export interface SeoCategoryReport {
  name: string;
  score: number;
  findings: SeoFinding[];
}

/** A keyword opportunity suggested by the AI. */
export interface SeoKeywordOpportunity {
  keyword: string;
  intent: string;
  suggestion: string;
}

/** Elaborate professional SEO report produced by the AI. */
export interface SeoReportOutput {
  executiveSummary: string;
  overallScore: number;
  categories: SeoCategoryReport[];
  quickWins: string[];
  longTermActions: string[];
  keywordOpportunities: SeoKeywordOpportunity[];
}

/** A single technical finding extracted by the page fetch (reuses WebAuditIssue shape). */
export interface SeoIssue {
  id: string;
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
}

/** Technical data extracted directly from the page HTML — no AI involved. */
export interface SeoTechnicalData {
  url: string;
  finalUrl: string | null;
  reachable: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  pageSizeBytes: number | null;

  usesHttps: boolean;
  hasViewport: boolean;
  lang: string | null;

  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonicalUrl: string | null;
  robotsMeta: string | null;

  hasOgTags: boolean;
  hasTwitterCard: boolean;
  hasStructuredData: boolean;
  structuredDataTypes: string[];

  h1Count: number;
  h1Texts: string[];
  h2Count: number;

  imageCount: number;
  imagesMissingAlt: number;

  internalLinkCount: number;
  externalLinkCount: number;
  wordCount: number;

  hasAnalytics: boolean;
  hasFavicon: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  copyrightYear: number | null;

  issues: SeoIssue[];
  score: number;
  auditedAt: string;
}

/** Input used to generate the AI SEO report. */
export interface SeoAuditInput {
  url: string;
  businessName: string | null;
  technical: SeoTechnicalData;
}

/** A persisted SEO audit. */
export interface SeoAuditData {
  id: string;
  url: string;
  finalUrl: string | null;
  businessName: string | null;
  model: string;
  technical: SeoTechnicalData;
  report: SeoReportOutput;
  score: number;
  createdAt: string;
  updatedAt: string;
}

/** A business with a known website — alternative input source for SEO audits. */
export interface SeoAuditCandidate {
  placeId: string;
  businessName: string;
  websiteUri: string;
}
