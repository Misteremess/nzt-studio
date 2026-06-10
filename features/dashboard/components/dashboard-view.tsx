"use client";

// features/dashboard/components/dashboard-view.tsx
// Full-width analytics overview of the whole NZT pipeline: KPIs, conversion
// funnel, activity trend, opportunity triage, delivery status and recent feed.

import Link from "next/link";
import {
  ScanSearch,
  Zap,
  Code2,
  Calculator,
  FileText,
  Truck,
  TrendingUp,
  Euro,
  ArrowRight,
  Activity,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, BarList, Donut, Funnel, StatTile } from "@/components/ui/charts";
import type { DashboardData, RecentItem } from "@/features/dashboard/types";

interface Props {
  data: DashboardData;
}

const KIND_META: Record<RecentItem["kind"], { label: string; cls: string }> = {
  analysis: { label: "Análisis", cls: "text-sky-400" },
  opportunity: { label: "Oportunidad", cls: "text-emerald-400" },
  spec: { label: "MVP", cls: "text-indigo-400" },
  proposal: { label: "Propuesta", cls: "text-amber-400" },
  delivery: { label: "Entrega", cls: "text-rose-400" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

const QUICK_LINKS = [
  { title: "Rastreador", href: "/rastreador", icon: ScanSearch },
  { title: "Opportunity Engine", href: "/opportunity-engine", icon: Zap },
  { title: "MVP Factory", href: "/mvp-factory", icon: Code2 },
  { title: "Pricing Studio", href: "/pricing-studio", icon: Calculator },
  { title: "Proposal Builder", href: "/proposal-builder", icon: FileText },
  { title: "Delivery Workspace", href: "/delivery-workspace", icon: Truck },
];

export function DashboardView({ data }: Props) {
  const { kpis } = data;
  const fmtEur = (n: number) => `${n.toLocaleString("es-ES")} €`;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vista global de tu pipeline: del análisis de mercado a la entrega del MVP.
          </p>
        </div>
        <Link
          href="/rastreador"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ScanSearch className="h-3.5 w-3.5" />
          Buscar negocios
        </Link>
      </div>

      {!data.hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Analizados" value={kpis.analyses} icon={<ScanSearch className="h-4 w-4" />} />
            <StatTile label="Oportunidades" value={kpis.opportunities} icon={<Zap className="h-4 w-4" />} accent="#34d399" />
            <StatTile label="MVP specs" value={kpis.specs} icon={<Code2 className="h-4 w-4" />} accent="hsl(var(--primary))" />
            <StatTile label="Propuestas" value={kpis.proposals} icon={<FileText className="h-4 w-4" />} accent="#fbbf24" />
            <StatTile label="En entrega" value={kpis.activeDeliveries} icon={<Truck className="h-4 w-4" />} accent="#60a5fa" />
            <StatTile label="Entregados" value={kpis.delivered} icon={<TrendingUp className="h-4 w-4" />} accent="#34d399" />
          </div>

          {/* Revenue band */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Euro className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ingresos potenciales (setup)</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {fmtEur(kpis.potentialRevenue)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recurrente potencial / mes</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {fmtEur(kpis.recurringRevenue)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main analytics grid */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Funnel — wide */}
            <Card className="lg:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Embudo de conversión</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Funnel data={data.funnel} />
              </CardContent>
            </Card>

            {/* Quadrants donut */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Oportunidades por tipo</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {data.quadrants.length > 0 ? (
                  <Donut
                    data={data.quadrants}
                    size={150}
                    centerValue={kpis.opportunities}
                    centerLabel="total"
                  />
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sin oportunidades</p>
                )}
              </CardContent>
            </Card>

            {/* Activity area */}
            <Card className="lg:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Actividad (8 semanas)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <AreaChart data={data.activity} />
              </CardContent>
            </Card>

            {/* Delivery status */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Estado de entregas</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {data.deliveryStatus.length > 0 ? (
                  <Donut data={data.deliveryStatus} size={150} />
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sin entregas aún</p>
                )}
              </CardContent>
            </Card>

            {/* Top businesses */}
            <Card className="lg:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Negocios con más oportunidades</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <BarList data={data.topBusinesses} />
              </CardContent>
            </Card>

            {/* Recent feed */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Actividad reciente</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {data.recent.length > 0 ? (
                  <ul className="space-y-2.5">
                    {data.recent.map((r) => {
                      const meta = KIND_META[r.kind];
                      return (
                        <li key={r.id} className="flex items-start gap-2 text-xs">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${meta.cls}`} style={{ backgroundColor: "currentColor" }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-foreground">{r.businessName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              <span className={meta.cls}>{meta.label}</span> · {r.title}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(r.at)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sin actividad</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick links */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Accesos rápidos
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {QUICK_LINKS.map((l) => {
                const Icon = l.icon;
                return (
                  <Link key={l.href} href={l.href} className="group">
                    <Card className="h-full transition-colors hover:border-primary/40 hover:bg-secondary/50">
                      <CardContent className="flex items-center gap-2 p-3">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                        <span className="truncate text-xs font-medium text-foreground">{l.title}</span>
                        <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
      <TrendingUp className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">Tu pipeline está vacío</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Empieza buscando negocios en el Rastreador y analizándolos. A medida que generes
          oportunidades, MVPs y propuestas, este panel se llenará de analíticas en tiempo real.
        </p>
      </div>
      <Link
        href="/rastreador"
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <ScanSearch className="h-3.5 w-3.5" />
        Empezar
      </Link>
    </div>
  );
}
