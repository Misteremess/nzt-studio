// features/dashboard/lib/store.ts
// Server-only aggregate reads for the Dashboard. Summarizes the whole AI
// pipeline (analyses → opportunities → specs → pricing → proposals → delivery)
// into KPIs, a conversion funnel, charts and a recent-activity feed.
import "server-only";

import type { OppLevel } from "@/features/analyzer/types";
import { quadrantOf } from "@/features/opportunity-engine/lib/scoring";
import type { OppQuadrant } from "@/features/opportunity-engine/types";
import { prisma } from "@/db/prisma";
import type {
  DashboardData,
  RecentItem,
  SeriesPointData,
  SliceData,
} from "@/features/dashboard/types";

const QUADRANT_LABEL: Record<OppQuadrant, string> = {
  "quick-win": "Quick wins",
  "big-bet": "Grandes apuestas",
  "fill-in": "Relleno",
  thankless: "Ingratas",
  unrated: "Sin valorar",
};

const QUADRANT_COLOR: Record<OppQuadrant, string> = {
  "quick-win": "#34d399",
  "big-bet": "hsl(var(--primary))",
  "fill-in": "#60a5fa",
  thankless: "#fb7185",
  unrated: "hsl(var(--muted-foreground))",
};

const DELIVERY_LABEL: Record<string, string> = {
  QUEUED: "En cola",
  IN_PROGRESS: "En desarrollo",
  IN_REVIEW: "En revisión",
  DELIVERED: "Entregado",
  ON_HOLD: "En pausa",
  CANCELLED: "Cancelado",
};

const DELIVERY_COLOR: Record<string, string> = {
  QUEUED: "hsl(var(--muted-foreground))",
  IN_PROGRESS: "hsl(var(--primary))",
  IN_REVIEW: "#fbbf24",
  DELIVERED: "#34d399",
  ON_HOLD: "#a1a1aa",
  CANCELLED: "#fb7185",
};

function weekKey(d: Date): string {
  // ISO-ish week bucket label "dd/mm".
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboardData(): Promise<DashboardData> {
  const activeAnalysis = { archivedAt: null };
  const activeOpp = { analysis: { archivedAt: null } };
  const activeSpec = { archivedAt: null, opportunity: { analysis: { archivedAt: null } } };
  const activeProposal = { archivedAt: null, mvpSpec: activeSpec };

  const [
    analyses,
    opportunities,
    selected,
    specs,
    proposals,
    deliveries,
    pricings,
    oppRows,
    topBusinessRows,
    recentAnalyses,
    recentProposals,
  ] = await Promise.all([
    prisma.businessAnalysis.count({ where: activeAnalysis }),
    prisma.aiOpportunity.count({ where: activeOpp }),
    prisma.aiOpportunity.count({ where: { selected: true, ...activeOpp } }),
    prisma.aiMvpSpec.count({ where: activeSpec }),
    prisma.aiProposal.count({ where: activeProposal }),
    prisma.aiDelivery.findMany({
      where: { mvpSpec: activeSpec },
      select: { status: true },
    }),
    prisma.aiPricing.findMany({
      where: { archivedAt: null, mvpSpec: activeSpec },
      select: { setupPrice: true, monthlyPrice: true },
    }),
    prisma.aiOpportunity.findMany({
      where: activeOpp,
      select: { impact: true, effort: true, createdAt: true },
    }),
    prisma.businessAnalysis.findMany({
      where: activeAnalysis,
      select: { businessName: true, _count: { select: { opportunities: true } } },
      orderBy: { opportunities: { _count: "desc" } },
      take: 6,
    }),
    prisma.businessAnalysis.findMany({
      where: activeAnalysis,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, businessName: true, createdAt: true },
    }),
    prisma.aiProposal.findMany({
      where: activeProposal,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        createdAt: true,
        mvpSpec: { select: { opportunity: { select: { analysis: { select: { businessName: true } } } } } },
      },
    }),
  ]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const activeDeliveries = deliveries.filter(
    (d) => d.status !== "DELIVERED" && d.status !== "CANCELLED"
  ).length;
  const delivered = deliveries.filter((d) => d.status === "DELIVERED").length;
  const potentialRevenue = pricings.reduce((s, p) => s + (p.setupPrice ?? 0), 0);
  const recurringRevenue = pricings.reduce((s, p) => s + (p.monthlyPrice ?? 0), 0);

  // ── Funnel ────────────────────────────────────────────────────────────────────
  const funnel = [
    { label: "Analizados", value: analyses },
    { label: "Oportunidades", value: opportunities },
    { label: "Seleccionadas", value: selected },
    { label: "MVP spec", value: specs },
    { label: "Propuestas", value: proposals },
    { label: "Entregas", value: deliveries.length },
  ];

  // ── Quadrants ─────────────────────────────────────────────────────────────────
  const quadCount = new Map<OppQuadrant, number>();
  for (const o of oppRows) {
    const q = quadrantOf((o.impact as OppLevel | null) ?? null, (o.effort as OppLevel | null) ?? null);
    quadCount.set(q, (quadCount.get(q) ?? 0) + 1);
  }
  const quadrants: SliceData[] = (
    ["quick-win", "big-bet", "fill-in", "thankless", "unrated"] as OppQuadrant[]
  )
    .map((q) => ({ label: QUADRANT_LABEL[q], value: quadCount.get(q) ?? 0, color: QUADRANT_COLOR[q] }))
    .filter((s) => s.value > 0);

  // ── Activity (last 8 weeks of opportunities) ──────────────────────────────────
  const now = new Date();
  const buckets: { key: string; start: number; end: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    buckets.push({ key: weekKey(end), start: start.getTime(), end: end.getTime() });
  }
  const activity: SeriesPointData[] = buckets.map((b) => ({
    label: b.key,
    value: oppRows.filter((o) => {
      const t = o.createdAt.getTime();
      return t > b.start && t <= b.end;
    }).length,
  }));

  // ── Top businesses ────────────────────────────────────────────────────────────
  const topBusinesses = topBusinessRows
    .map((b) => ({ label: b.businessName, value: b._count.opportunities }))
    .filter((b) => b.value > 0);

  // ── Delivery status ───────────────────────────────────────────────────────────
  const statusCount = new Map<string, number>();
  for (const d of deliveries) statusCount.set(d.status, (statusCount.get(d.status) ?? 0) + 1);
  const deliveryStatus: SliceData[] = [...statusCount.entries()].map(([status, value]) => ({
    label: DELIVERY_LABEL[status] ?? status,
    value,
    color: DELIVERY_COLOR[status],
  }));

  // ── Recent activity feed ──────────────────────────────────────────────────────
  const recent: RecentItem[] = [
    ...recentAnalyses.map((a) => ({
      id: `a-${a.id}`,
      kind: "analysis" as const,
      title: "Negocio analizado",
      businessName: a.businessName,
      at: a.createdAt.toISOString(),
    })),
    ...recentProposals.map((p) => ({
      id: `p-${p.id}`,
      kind: "proposal" as const,
      title: p.title,
      businessName: p.mvpSpec.opportunity.analysis.businessName,
      at: p.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return {
    kpis: {
      analyses,
      opportunities,
      selected,
      specs,
      proposals,
      activeDeliveries,
      delivered,
      potentialRevenue,
      recurringRevenue,
    },
    funnel,
    quadrants,
    activity,
    topBusinesses,
    deliveryStatus,
    recent,
    hasData: analyses > 0 || opportunities > 0,
  };
}
