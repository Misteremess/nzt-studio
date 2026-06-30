// features/content-seo/lib/store.ts
// Server-only Prisma helpers for the Content/SEO Agent.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  ContentPlanCandidate,
  ContentPlanData,
  ContentPlanOutput,
  SeoAuditCandidate,
  SeoAuditData,
  SeoCategoryReport,
  SeoFinding,
  SeoIssue,
  SeoKeywordOpportunity,
  SeoReportOutput,
  SeoTechnicalData,
  ContentTopic,
  LandingCopy,
} from "@/features/content-seo/types";
import type { WebAuditIssue, WebAuditResult } from "@/features/rastreador/types";

/** Lists analyzed businesses, with their web-audit SEO issues and whether a plan already exists. */
export async function listContentPlanCandidates(): Promise<ContentPlanCandidate[]> {
  const analyses = await prisma.businessAnalysis.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { placeId: true, businessName: true, summary: true },
  });
  if (analyses.length === 0) return [];

  const placeIds = analyses.map((a) => a.placeId);
  const [placeCaches, plans] = await Promise.all([
    prisma.placeCache.findMany({
      where: { placeId: { in: placeIds } },
      select: { placeId: true, primaryType: true, webAudit: true },
    }),
    prisma.aiContentPlan.findMany({
      where: { placeId: { in: placeIds } },
      select: { placeId: true },
    }),
  ]);

  const placeCacheByPlaceId = new Map(placeCaches.map((p) => [p.placeId, p]));
  const planPlaceIds = new Set(plans.map((p) => p.placeId));

  return analyses.map((a) => {
    const cache = placeCacheByPlaceId.get(a.placeId);
    return {
      placeId: a.placeId,
      businessName: a.businessName,
      primaryType: cache?.primaryType ?? null,
      summary: a.summary,
      seoIssues: toSeoIssues(cache?.webAudit ?? null),
      hasPlan: planPlaceIds.has(a.placeId),
    };
  });
}

export async function getContentPlan(placeId: string): Promise<ContentPlanData | null> {
  const row = await prisma.aiContentPlan.findUnique({ where: { placeId } });
  return row ? toContentPlanData(row) : null;
}

export async function listContentPlans(): Promise<ContentPlanData[]> {
  const rows = await prisma.aiContentPlan.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(toContentPlanData);
}

/** Creates or replaces the content plan for a business (1:1 relation). */
export async function upsertContentPlan(
  input: { placeId: string; businessName: string },
  output: ContentPlanOutput,
  model: string,
  raw: unknown
): Promise<ContentPlanData> {
  const data = {
    businessName: input.businessName,
    model,
    topics: output.topics as unknown as Prisma.InputJsonValue,
    landingCopy: output.landingCopy as unknown as Prisma.InputJsonValue,
    seoNotes: output.seoNotes as unknown as Prisma.InputJsonValue,
    rawOutput: (raw ?? null) as Prisma.InputJsonValue,
  };
  const row = await prisma.aiContentPlan.upsert({
    where: { placeId: input.placeId },
    create: { placeId: input.placeId, ...data },
    update: data,
  });
  return toContentPlanData(row);
}

export async function deleteContentPlan(placeId: string): Promise<void> {
  await prisma.aiContentPlan.delete({ where: { placeId } });
}

// ─── SEO Audit (URL-based) ──────────────────────────────────────────────────

/** Lists businesses with a known website — alternative input source for SEO audits. */
export async function listSeoAuditCandidates(): Promise<SeoAuditCandidate[]> {
  const rows = await prisma.placeCache.findMany({
    where: { websiteUri: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { placeId: true, name: true, websiteUri: true },
    distinct: ["placeId"],
  });

  return rows
    .filter((r): r is typeof r & { websiteUri: string } => !!r.websiteUri)
    .map((r) => ({ placeId: r.placeId, businessName: r.name, websiteUri: r.websiteUri }));
}

export async function listSeoAudits(includeArchived = false): Promise<SeoAuditData[]> {
  const rows = await prisma.aiSeoAudit.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toSeoAuditData);
}

export async function createSeoAudit(input: {
  url: string;
  businessName: string | null;
  technical: SeoTechnicalData;
  report: SeoReportOutput;
  model: string;
  raw: unknown;
}): Promise<SeoAuditData> {
  const row = await prisma.aiSeoAudit.create({
    data: {
      url: input.url,
      finalUrl: input.technical.finalUrl,
      businessName: input.businessName,
      model: input.model,
      technical: input.technical as unknown as Prisma.InputJsonValue,
      report: input.report as unknown as Prisma.InputJsonValue,
      score: input.technical.score,
      rawOutput: (input.raw ?? null) as Prisma.InputJsonValue,
    },
  });
  return toSeoAuditData(row);
}

export async function archiveSeoAudit(id: string): Promise<void> {
  await prisma.aiSeoAudit.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function restoreSeoAudit(id: string): Promise<void> {
  await prisma.aiSeoAudit.update({ where: { id }, data: { archivedAt: null } });
}

export async function deleteSeoAudit(id: string): Promise<void> {
  await prisma.aiSeoAudit.delete({ where: { id } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type ContentPlanRow = Prisma.AiContentPlanGetPayload<object>;

function toContentPlanData(row: ContentPlanRow): ContentPlanData {
  return {
    id: row.id,
    placeId: row.placeId,
    businessName: row.businessName,
    model: row.model,
    topics: toTopics(row.topics),
    landingCopy: toLandingCopy(row.landingCopy),
    seoNotes: toStringArray(row.seoNotes),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toTopics(value: Prisma.JsonValue): ContentTopic[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
      const r = v as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : "";
      const angle = typeof r.angle === "string" ? r.angle : "";
      const format = typeof r.format === "string" ? r.format : "";
      const keywords = Array.isArray(r.keywords) ? r.keywords.filter((k): k is string => typeof k === "string") : [];
      if (!title) return null;
      return { title, angle, keywords, format };
    })
    .filter((t): t is ContentTopic => t !== null);
}

function toLandingCopy(value: Prisma.JsonValue): LandingCopy {
  const empty: LandingCopy = { headline: "", subheadline: "", ctaLabel: "", bullets: [] };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return empty;
  const r = value as Record<string, unknown>;
  return {
    headline: typeof r.headline === "string" ? r.headline : "",
    subheadline: typeof r.subheadline === "string" ? r.subheadline : "",
    ctaLabel: typeof r.ctaLabel === "string" ? r.ctaLabel : "",
    bullets: Array.isArray(r.bullets) ? r.bullets.filter((b): b is string => typeof b === "string") : [],
  };
}

function toSeoIssues(webAudit: Prisma.JsonValue | null): string[] {
  if (typeof webAudit !== "object" || webAudit === null || Array.isArray(webAudit)) return [];
  const audit = webAudit as unknown as Partial<WebAuditResult>;
  if (!Array.isArray(audit.issues)) return [];
  return audit.issues
    .filter((issue): issue is WebAuditIssue => typeof issue === "object" && issue !== null)
    .map((issue) => `${issue.label}: ${issue.detail}`);
}

// ─── SEO Audit mappers ──────────────────────────────────────────────────────

type SeoAuditRow = Prisma.AiSeoAuditGetPayload<object>;

function toSeoAuditData(row: SeoAuditRow): SeoAuditData {
  return {
    id: row.id,
    url: row.url,
    finalUrl: row.finalUrl,
    businessName: row.businessName,
    model: row.model,
    technical: toSeoTechnicalData(row.technical),
    report: toSeoReportOutput(row.report),
    score: row.score,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SEO_FINDING_STATUSES: SeoFinding["status"][] = ["ok", "warning", "critical"];
const SEO_SEVERITIES: SeoIssue["severity"][] = ["low", "medium", "high"];

function toSeoTechnicalData(value: Prisma.JsonValue): SeoTechnicalData {
  const empty: SeoTechnicalData = {
    url: "",
    finalUrl: null,
    reachable: false,
    httpStatus: null,
    responseTimeMs: null,
    pageSizeBytes: null,
    usesHttps: false,
    hasViewport: false,
    lang: null,
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonicalUrl: null,
    robotsMeta: null,
    hasOgTags: false,
    hasTwitterCard: false,
    hasStructuredData: false,
    structuredDataTypes: [],
    h1Count: 0,
    h1Texts: [],
    h2Count: 0,
    imageCount: 0,
    imagesMissingAlt: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    wordCount: 0,
    hasAnalytics: false,
    hasFavicon: false,
    hasRobotsTxt: false,
    hasSitemap: false,
    copyrightYear: null,
    issues: [],
    score: 0,
    auditedAt: new Date().toISOString(),
  };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return empty;
  const r = value as Record<string, unknown>;

  const issues = Array.isArray(r.issues)
    ? r.issues
        .map((i): SeoIssue | null => {
          if (typeof i !== "object" || i === null) return null;
          const ir = i as Record<string, unknown>;
          const severity = SEO_SEVERITIES.includes(ir.severity as SeoIssue["severity"])
            ? (ir.severity as SeoIssue["severity"])
            : "low";
          return {
            id: typeof ir.id === "string" ? ir.id : "",
            label: typeof ir.label === "string" ? ir.label : "",
            detail: typeof ir.detail === "string" ? ir.detail : "",
            severity,
          };
        })
        .filter((i): i is SeoIssue => i !== null)
    : [];

  return {
    ...empty,
    url: typeof r.url === "string" ? r.url : "",
    finalUrl: typeof r.finalUrl === "string" ? r.finalUrl : null,
    reachable: typeof r.reachable === "boolean" ? r.reachable : false,
    httpStatus: typeof r.httpStatus === "number" ? r.httpStatus : null,
    responseTimeMs: typeof r.responseTimeMs === "number" ? r.responseTimeMs : null,
    pageSizeBytes: typeof r.pageSizeBytes === "number" ? r.pageSizeBytes : null,
    usesHttps: typeof r.usesHttps === "boolean" ? r.usesHttps : false,
    hasViewport: typeof r.hasViewport === "boolean" ? r.hasViewport : false,
    lang: typeof r.lang === "string" ? r.lang : null,
    title: typeof r.title === "string" ? r.title : null,
    titleLength: typeof r.titleLength === "number" ? r.titleLength : 0,
    metaDescription: typeof r.metaDescription === "string" ? r.metaDescription : null,
    metaDescriptionLength: typeof r.metaDescriptionLength === "number" ? r.metaDescriptionLength : 0,
    canonicalUrl: typeof r.canonicalUrl === "string" ? r.canonicalUrl : null,
    robotsMeta: typeof r.robotsMeta === "string" ? r.robotsMeta : null,
    hasOgTags: typeof r.hasOgTags === "boolean" ? r.hasOgTags : false,
    hasTwitterCard: typeof r.hasTwitterCard === "boolean" ? r.hasTwitterCard : false,
    hasStructuredData: typeof r.hasStructuredData === "boolean" ? r.hasStructuredData : false,
    structuredDataTypes: Array.isArray(r.structuredDataTypes)
      ? r.structuredDataTypes.filter((t): t is string => typeof t === "string")
      : [],
    h1Count: typeof r.h1Count === "number" ? r.h1Count : 0,
    h1Texts: Array.isArray(r.h1Texts) ? r.h1Texts.filter((t): t is string => typeof t === "string") : [],
    h2Count: typeof r.h2Count === "number" ? r.h2Count : 0,
    imageCount: typeof r.imageCount === "number" ? r.imageCount : 0,
    imagesMissingAlt: typeof r.imagesMissingAlt === "number" ? r.imagesMissingAlt : 0,
    internalLinkCount: typeof r.internalLinkCount === "number" ? r.internalLinkCount : 0,
    externalLinkCount: typeof r.externalLinkCount === "number" ? r.externalLinkCount : 0,
    wordCount: typeof r.wordCount === "number" ? r.wordCount : 0,
    hasAnalytics: typeof r.hasAnalytics === "boolean" ? r.hasAnalytics : false,
    hasFavicon: typeof r.hasFavicon === "boolean" ? r.hasFavicon : false,
    hasRobotsTxt: typeof r.hasRobotsTxt === "boolean" ? r.hasRobotsTxt : false,
    hasSitemap: typeof r.hasSitemap === "boolean" ? r.hasSitemap : false,
    copyrightYear: typeof r.copyrightYear === "number" ? r.copyrightYear : null,
    issues,
    score: typeof r.score === "number" ? r.score : 0,
    auditedAt: typeof r.auditedAt === "string" ? r.auditedAt : new Date().toISOString(),
  };
}

function toSeoReportOutput(value: Prisma.JsonValue): SeoReportOutput {
  const empty: SeoReportOutput = {
    executiveSummary: "",
    overallScore: 0,
    categories: [],
    quickWins: [],
    longTermActions: [],
    keywordOpportunities: [],
  };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return empty;
  const r = value as Record<string, unknown>;

  const categories = Array.isArray(r.categories)
    ? r.categories
        .map((c): SeoCategoryReport | null => {
          if (typeof c !== "object" || c === null) return null;
          const cr = c as Record<string, unknown>;
          const name = typeof cr.name === "string" ? cr.name : "";
          if (!name) return null;
          const findings = Array.isArray(cr.findings)
            ? cr.findings
                .map((f): SeoFinding | null => {
                  if (typeof f !== "object" || f === null) return null;
                  const fr = f as Record<string, unknown>;
                  const title = typeof fr.title === "string" ? fr.title : "";
                  if (!title) return null;
                  const status = SEO_FINDING_STATUSES.includes(fr.status as SeoFinding["status"])
                    ? (fr.status as SeoFinding["status"])
                    : "warning";
                  return {
                    title,
                    status,
                    description: typeof fr.description === "string" ? fr.description : "",
                    recommendation: typeof fr.recommendation === "string" ? fr.recommendation : "",
                  };
                })
                .filter((f): f is SeoFinding => f !== null)
            : [];
          return { name, score: typeof cr.score === "number" ? cr.score : 0, findings };
        })
        .filter((c): c is SeoCategoryReport => c !== null)
    : [];

  const keywordOpportunities = Array.isArray(r.keywordOpportunities)
    ? r.keywordOpportunities
        .map((k): SeoKeywordOpportunity | null => {
          if (typeof k !== "object" || k === null) return null;
          const kr = k as Record<string, unknown>;
          const keyword = typeof kr.keyword === "string" ? kr.keyword : "";
          if (!keyword) return null;
          return {
            keyword,
            intent: typeof kr.intent === "string" ? kr.intent : "",
            suggestion: typeof kr.suggestion === "string" ? kr.suggestion : "",
          };
        })
        .filter((k): k is SeoKeywordOpportunity => k !== null)
    : [];

  return {
    executiveSummary: typeof r.executiveSummary === "string" ? r.executiveSummary : "",
    overallScore: typeof r.overallScore === "number" ? r.overallScore : 0,
    categories,
    quickWins: Array.isArray(r.quickWins) ? r.quickWins.filter((q): q is string => typeof q === "string") : [],
    longTermActions: Array.isArray(r.longTermActions)
      ? r.longTermActions.filter((a): a is string => typeof a === "string")
      : [],
    keywordOpportunities,
  };
}
