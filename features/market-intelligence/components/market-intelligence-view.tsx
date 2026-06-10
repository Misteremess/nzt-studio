"use client";

// features/market-intelligence/components/market-intelligence-view.tsx
// Full-width market analytics across every analyzed business: sectors, ratings,
// opportunity themes, impact/effort spread, coverage and a sortable table.

import { useMemo, useState } from "react";
import { TrendingUp, Search, Star, Lightbulb, MapPinned } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarList, Donut, StatTile } from "@/components/ui/charts";
import type { MarketData, MiBusinessRow } from "@/features/market-intelligence/types";

interface Props {
  data: MarketData;
}

type SortKey = "opportunities" | "rating" | "reviews" | "name";

export function MarketIntelligenceView({ data }: Props) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("opportunities");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.businesses.filter(
      (b) =>
        !needle ||
        b.businessName.toLowerCase().includes(needle) ||
        b.sector.toLowerCase().includes(needle)
    );
    return [...list].sort((a, b) => {
      switch (sort) {
        case "rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "reviews":
          return (b.reviews ?? 0) - (a.reviews ?? 0);
        case "name":
          return a.businessName.localeCompare(b.businessName);
        default:
          return b.opportunities - a.opportunities;
      }
    });
  }, [data.businesses, q, sort]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <TrendingUp className="h-4 w-4" />
          Market Intelligence
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Inteligencia de mercado a partir de todos los negocios que has analizado: sectores,
          reputación, temas de oportunidad y cobertura.
        </p>
      </div>

      {!data.hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Coverage tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Descubiertos"
              value={data.coverage.discovered}
              sub="por el Rastreador"
              icon={<MapPinned className="h-4 w-4" />}
            />
            <StatTile
              label="Analizados"
              value={data.coverage.analyzed}
              sub="con IA"
              icon={<Search className="h-4 w-4" />}
              accent="hsl(var(--primary))"
            />
            <StatTile
              label="Oportunidades"
              value={data.coverage.opportunities}
              icon={<Lightbulb className="h-4 w-4" />}
              accent="#34d399"
            />
            <StatTile
              label="Media / negocio"
              value={data.coverage.avgOppsPerBusiness}
              sub="oportunidades"
              accent="#fbbf24"
            />
          </div>

          {/* Insight banner */}
          {data.insight && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-start gap-3 p-4">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-foreground">
                  El <span className="font-semibold">{data.insight.lowRatedShare}%</span> de los
                  negocios analizados tienen una valoración por debajo de 4.0. Estos generan de media{" "}
                  <span className="font-semibold text-emerald-400">
                    {data.insight.lowRatedAvgOpps}
                  </span>{" "}
                  oportunidades frente a{" "}
                  <span className="font-semibold">{data.insight.highRatedAvgOpps}</span> de los mejor
                  valorados — los negocios con peor reputación suelen tener más margen de mejora.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Charts grid */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Sectores analizados</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <BarList data={data.sectors} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="inline-flex items-center gap-1.5 text-sm">
                  <Star className="h-3.5 w-3.5" /> Reputación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {data.ratingDistribution.length > 0 ? (
                  <Donut data={data.ratingDistribution} size={150} />
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sin valoraciones</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Impacto</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Donut data={data.impactDistribution} size={140} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Esfuerzo</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Donut data={data.effortDistribution} size={140} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Temas recurrentes</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {data.themes.length > 0 ? (
                  <BarList data={data.themes} />
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Aún no hay patrones claros
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Businesses table */}
          <Card>
            <CardHeader className="flex flex-col gap-2 p-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm">Negocios analizados ({data.businesses.length})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar…"
                    className="h-8 w-40 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Ordenar"
                  className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="opportunities">Más oportunidades</option>
                  <option value="rating">Mejor valorados</option>
                  <option value="reviews">Más reseñas</option>
                  <option value="name">Nombre</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Negocio</th>
                      <th className="px-4 py-2 font-medium">Sector</th>
                      <th className="px-4 py-2 text-right font-medium">Valoración</th>
                      <th className="px-4 py-2 text-right font-medium">Reseñas</th>
                      <th className="px-4 py-2 text-right font-medium">Oport.</th>
                      <th className="px-4 py-2 text-right font-medium">Selec.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <BusinessRow key={b.placeId} row={b} />
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Ningún negocio coincide.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function BusinessRow({ row }: { row: MiBusinessRow }) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
      <td className="px-4 py-2.5 font-medium text-foreground">
        <span className="line-clamp-1">{row.businessName}</span>
        {row.status && row.status !== "OPERATIONAL" && (
          <span className="ml-1 text-[10px] text-rose-400">cerrado</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{row.sector}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {row.rating != null ? (
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {row.rating.toFixed(1)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
        {row.reviews ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="font-semibold tabular-nums text-foreground">{row.opportunities}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span
          className={cn(
            "tabular-nums",
            row.selected > 0 ? "font-semibold text-indigo-400" : "text-muted-foreground"
          )}
        >
          {row.selected}
        </span>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-12 text-center">
      <TrendingUp className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Sin datos de mercado todavía</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Analiza negocios en el Analyzer para construir tu inteligencia de mercado. Verás aquí
        sectores, reputación y los temas de oportunidad más frecuentes.
      </p>
    </div>
  );
}
