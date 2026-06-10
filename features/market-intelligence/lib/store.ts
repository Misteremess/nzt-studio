// features/market-intelligence/lib/store.ts
// Server-only aggregate reads for Market Intelligence. Joins analyzed businesses
// (BusinessAnalysis) with their market data from the Rastreador cache
// (PlaceCache) and the opportunities found, to surface sector, rating and theme
// intelligence across the whole scanned market.
import "server-only";

import { prisma } from "@/db/prisma";
import type { OppLevel } from "@/features/analyzer/types";
import type { MarketData, MiBar, MiBusinessRow, MiSlice } from "@/features/market-intelligence/types";

/** Turns a Google place type ("hair_salon") into a label ("Hair salon"). */
function humanizeSector(type: string | null | undefined): string {
  if (!type) return "Sin categoría";
  const s = type.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Spanish + generic stopwords to drop when mining opportunity themes.
const STOPWORDS = new Set([
  "de","la","el","los","las","un","una","unos","unas","y","o","u","a","en","con","para","por","del",
  "al","que","se","su","sus","lo","le","les","como","más","mas","muy","sin","sobre","entre","es","ser",
  "the","a","an","and","or","of","to","for","with","new","sistema","plataforma","app","web","online",
  "negocio","cliente","clientes","servicio","servicios","mejora","mejorar","nueva","nuevo","gestión",
  "gestion","digital",
]);

function mineThemes(titles: string[]): MiBar[] {
  const freq = new Map<string, number>();
  for (const t of titles) {
    const words = t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    for (const w of new Set(words)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value }));
}

export async function getMarketData(): Promise<MarketData> {
  const [analyses, discovered, opps] = await Promise.all([
    prisma.businessAnalysis.findMany({
      where: { archivedAt: null },
      select: {
        placeId: true,
        businessName: true,
        opportunities: { select: { impact: true, effort: true, selected: true, title: true } },
      },
    }),
    prisma.placeCache.count(),
    prisma.aiOpportunity.findMany({
      where: { analysis: { archivedAt: null } },
      select: { title: true, impact: true, effort: true },
    }),
  ]);

  const placeIds = analyses.map((a) => a.placeId);
  const places = placeIds.length
    ? await prisma.placeCache.findMany({
        where: { placeId: { in: placeIds } },
        select: {
          placeId: true,
          primaryType: true,
          types: true,
          rating: true,
          userRatingCount: true,
          businessStatus: true,
        },
      })
    : [];
  const placeByid = new Map(places.map((p) => [p.placeId, p]));

  const opportunities = opps.length;
  const analyzed = analyses.length;

  // ── Sectors ─────────────────────────────────────────────────────────────────
  const sectorCount = new Map<string, number>();
  for (const a of analyses) {
    const p = placeByid.get(a.placeId);
    const sector = humanizeSector(p?.primaryType ?? p?.types?.[0]);
    sectorCount.set(sector, (sectorCount.get(sector) ?? 0) + 1);
  }
  const sectors: MiBar[] = [...sectorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  // ── Rating distribution ──────────────────────────────────────────────────────
  const ratingBuckets = [
    { label: "4.5 – 5.0", min: 4.5, color: "#34d399" },
    { label: "4.0 – 4.5", min: 4.0, color: "#a3e635" },
    { label: "3.0 – 4.0", min: 3.0, color: "#fbbf24" },
    { label: "< 3.0", min: 0, color: "#fb7185" },
  ];
  const ratingDistribution: MiSlice[] = ratingBuckets
    .map((b, i) => {
      const upper = i === 0 ? Infinity : ratingBuckets[i - 1].min;
      const value = analyses.filter((a) => {
        const r = placeByid.get(a.placeId)?.rating;
        return r != null && r >= b.min && r < upper;
      }).length;
      return { label: b.label, value, color: b.color };
    })
    .filter((s) => s.value > 0);

  // ── Impact / effort distribution ──────────────────────────────────────────────
  const levelDist = (key: "impact" | "effort"): MiSlice[] => {
    const meta: { level: OppLevel | "none"; label: string; color: string }[] = [
      { level: "high", label: "Alto", color: "#34d399" },
      { level: "medium", label: "Medio", color: "#fbbf24" },
      { level: "low", label: "Bajo", color: "#fb7185" },
      { level: "none", label: "Sin valorar", color: "hsl(var(--muted-foreground))" },
    ];
    return meta
      .map((m) => ({
        label: m.label,
        color: m.color,
        value: opps.filter((o) => (o[key] ?? "none") === m.level).length,
      }))
      .filter((s) => s.value > 0);
  };

  // ── Themes ────────────────────────────────────────────────────────────────────
  const themes = mineThemes(opps.map((o) => o.title));

  // ── Rating ↔ opportunity insight ──────────────────────────────────────────────
  let insight: MarketData["insight"] = null;
  const rated = analyses.filter((a) => placeByid.get(a.placeId)?.rating != null);
  if (rated.length >= 3) {
    const low = rated.filter((a) => (placeByid.get(a.placeId)?.rating ?? 0) < 4.0);
    const high = rated.filter((a) => (placeByid.get(a.placeId)?.rating ?? 0) >= 4.0);
    const avg = (arr: typeof rated) =>
      arr.length ? arr.reduce((s, a) => s + a.opportunities.length, 0) / arr.length : 0;
    insight = {
      lowRatedShare: Math.round((low.length / rated.length) * 100),
      lowRatedAvgOpps: Math.round(avg(low) * 10) / 10,
      highRatedAvgOpps: Math.round(avg(high) * 10) / 10,
    };
  }

  // ── Businesses table ───────────────────────────────────────────────────────────
  const businesses: MiBusinessRow[] = analyses
    .map((a) => {
      const p = placeByid.get(a.placeId);
      return {
        placeId: a.placeId,
        businessName: a.businessName,
        sector: humanizeSector(p?.primaryType ?? p?.types?.[0]),
        rating: p?.rating ?? null,
        reviews: p?.userRatingCount ?? null,
        opportunities: a.opportunities.length,
        selected: a.opportunities.filter((o) => o.selected).length,
        status: p?.businessStatus ?? null,
      };
    })
    .sort((a, b) => b.opportunities - a.opportunities);

  return {
    coverage: {
      discovered,
      analyzed,
      opportunities,
      avgOppsPerBusiness: analyzed ? Math.round((opportunities / analyzed) * 10) / 10 : 0,
    },
    sectors,
    ratingDistribution,
    impactDistribution: levelDist("impact"),
    effortDistribution: levelDist("effort"),
    themes,
    insight,
    businesses,
    hasData: analyzed > 0,
  };
}
