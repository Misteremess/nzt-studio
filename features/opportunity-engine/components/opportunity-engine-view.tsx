"use client";

// features/opportunity-engine/components/opportunity-engine-view.tsx
// Central, cross-business board of every AI-detected opportunity. Ranks by
// impact × effort priority, filters by business/quadrant/pipeline state, and
// lets the user mark opportunities for the MVP Factory.

import { useMemo, useState, useTransition } from "react";
import {
  Zap,
  Check,
  Loader2,
  Search,
  Code2,
  Calculator,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { setOpportunitySelectedAction } from "@/features/opportunity-engine/actions";
import { QUADRANT_META } from "@/features/opportunity-engine/lib/scoring";
import type {
  EngineData,
  EngineOpportunity,
  OppLevel,
  OppQuadrant,
} from "@/features/opportunity-engine/types";

type PipelineFilter = "all" | "selected" | "pending" | "with-spec";
type SortKey = "score" | "impact" | "effort" | "recent";

const LEVEL_ORDER: Record<OppLevel, number> = { high: 3, medium: 2, low: 1 };

interface Props {
  initialData: EngineData;
}

export function OpportunityEngineView({ initialData }: Props) {
  const [opps, setOpps] = useState<EngineOpportunity[]>(initialData.opportunities);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filters
  const [q, setQ] = useState("");
  const [business, setBusiness] = useState<string>("all");
  const [quadrant, setQuadrant] = useState<OppQuadrant | "all">("all");
  const [pipeline, setPipeline] = useState<PipelineFilter>("all");
  const [sort, setSort] = useState<SortKey>("score");

  const stats = useMemo(
    () => ({
      total: opps.length,
      selected: opps.filter((o) => o.selected).length,
      withSpec: opps.filter((o) => o.hasSpec).length,
      quickWins: opps.filter((o) => o.quadrant === "quick-win").length,
    }),
    [opps]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = opps.filter((o) => {
      if (business !== "all" && o.placeId !== business) return false;
      if (quadrant !== "all" && o.quadrant !== quadrant) return false;
      if (pipeline === "selected" && !o.selected) return false;
      if (pipeline === "pending" && o.selected) return false;
      if (pipeline === "with-spec" && !o.hasSpec) return false;
      if (needle) {
        const hay = `${o.title} ${o.description} ${o.development} ${o.businessName}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    const lvl = (v: OppLevel | null) => (v ? LEVEL_ORDER[v] : 0);
    return [...list].sort((a, b) => {
      switch (sort) {
        case "impact":
          return lvl(b.impact) - lvl(a.impact) || b.score - a.score;
        case "effort":
          return lvl(a.effort) - lvl(b.effort) || b.score - a.score;
        case "recent":
          return b.createdAt.localeCompare(a.createdAt);
        default:
          return b.score - a.score;
      }
    });
  }, [opps, q, business, quadrant, pipeline, sort]);

  function toggle(id: string, next: boolean, run: (fn: () => Promise<void>) => void) {
    setErrors((e) => ({ ...e, [id]: "" }));
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, selected: next } : o)));
    run(async () => {
      const result = await setOpportunitySelectedAction(id, next);
      if (!result.ok) {
        setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, selected: !next } : o)));
        setErrors((e) => ({ ...e, [id]: result.error }));
      }
    });
  }

  const filtersActive =
    q !== "" || business !== "all" || quadrant !== "all" || pipeline !== "all" || sort !== "score";

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <Zap className="h-4 w-4" />
          Opportunity Engine
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Todas las oportunidades detectadas por el Analyzer, priorizadas por impacto y esfuerzo.
          Marca las que quieras llevar al MVP Factory.
        </p>
      </div>

      {opps.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard label="Oportunidades" value={stats.total} />
            <StatCard label="Quick wins" value={stats.quickWins} accent="emerald" />
            <StatCard label="Seleccionadas" value={stats.selected} accent="indigo" />
            <StatCard label="Con MVP" value={stats.withSpec} accent="sky" />
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar oportunidad o negocio…"
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <Select value={business} onChange={setBusiness} ariaLabel="Filtrar por negocio">
              <option value="all">Todos los negocios</option>
              {initialData.businesses.map((b) => (
                <option key={b.placeId} value={b.placeId}>
                  {b.businessName} ({b.count})
                </option>
              ))}
            </Select>

            <Select
              value={quadrant}
              onChange={(v) => setQuadrant(v as OppQuadrant | "all")}
              ariaLabel="Filtrar por cuadrante"
            >
              <option value="all">Todos los cuadrantes</option>
              {(["quick-win", "big-bet", "fill-in", "thankless", "unrated"] as OppQuadrant[]).map(
                (qd) => (
                  <option key={qd} value={qd}>
                    {QUADRANT_META[qd].label}
                  </option>
                )
              )}
            </Select>

            <Select
              value={pipeline}
              onChange={(v) => setPipeline(v as PipelineFilter)}
              ariaLabel="Filtrar por estado"
            >
              <option value="all">Todos los estados</option>
              <option value="selected">Seleccionadas</option>
              <option value="pending">Sin seleccionar</option>
              <option value="with-spec">Con MVP generado</option>
            </Select>

            <Select value={sort} onChange={(v) => setSort(v as SortKey)} ariaLabel="Ordenar">
              <option value="score">Prioridad</option>
              <option value="impact">Mayor impacto</option>
              <option value="effort">Menor esfuerzo</option>
              <option value="recent">Más recientes</option>
            </Select>

            {filtersActive && (
              <button
                onClick={() => {
                  setQ("");
                  setBusiness("all");
                  setQuadrant("all");
                  setPipeline("all");
                  setSort("score");
                }}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* List */}
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} de {opps.length} oportunidades
          </p>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Ninguna oportunidad coincide con los filtros.
            </p>
          ) : (
            <div className="grid items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((o) => (
                <OpportunityCard key={o.id} opp={o} error={errors[o.id]} onToggle={toggle} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Opportunity card ───────────────────────────────────────────────────────

function OpportunityCard({
  opp,
  error,
  onToggle,
}: {
  opp: EngineOpportunity;
  error?: string;
  onToggle: (id: string, next: boolean, run: (fn: () => Promise<void>) => void) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const quad = QUADRANT_META[opp.quadrant];

  return (
    <Card className={cn("border-border", opp.selected && "border-indigo-500/50")}>
      <CardContent className="space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">{opp.businessName}</p>
            <p className="text-sm font-medium text-foreground">{opp.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground" title="Prioridad">
              {opp.score}
            </span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[10px]", quad.badge)} title={quad.hint}>
            {quad.label}
          </Badge>
          <LevelBadge label="Impacto" level={opp.impact} kind="impact" />
          <LevelBadge label="Esfuerzo" level={opp.effort} kind="effort" />
          {opp.hasSpec && <PipelineBadge icon={<Code2 className="h-3 w-3" />} label="MVP" />}
          {opp.hasPricing && (
            <PipelineBadge icon={<Calculator className="h-3 w-3" />} label="Pricing" />
          )}
          {opp.hasProposal && (
            <PipelineBadge icon={<FileText className="h-3 w-3" />} label="Propuesta" />
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">{opp.description}</p>

        {expanded && (
          <div className="rounded-md border border-border bg-background/40 p-2.5">
            <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
              <Sparkles className="h-3 w-3" /> Qué podríamos hacer
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{opp.development}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Ocultar" : "Ver desarrollo"}
          </button>

          <button
            onClick={() => onToggle(opp.id, !opp.selected, startTransition)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
              opp.selected
                ? "border-indigo-500 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                : "border-border bg-background/40 text-foreground hover:border-indigo-500/40"
            )}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : opp.selected ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {opp.selected ? "En MVP Factory" : "Llevar a MVP Factory"}
          </button>
        </div>

        {error && (
          <p className="inline-flex items-center gap-1 text-xs text-rose-400">
            <AlertTriangle className="h-3 w-3" /> {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Small pieces ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "indigo" | "sky";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "indigo"
        ? "text-indigo-400"
        : accent === "sky"
          ? "text-sky-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className={cn("text-2xl font-semibold leading-none", color)}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function LevelBadge({
  label,
  level,
  kind,
}: {
  label: string;
  level: OppLevel | null;
  kind: "impact" | "effort";
}) {
  const text = level === "high" ? "Alto" : level === "medium" ? "Medio" : level === "low" ? "Bajo" : "—";
  // For impact, high is good (emerald); for effort, high is costly (rose).
  const good = kind === "impact" ? level === "high" : level === "low";
  const bad = kind === "impact" ? level === "low" : level === "high";
  const cls = good
    ? "border-emerald-500/30 text-emerald-400"
    : bad
      ? "border-rose-500/30 text-rose-400"
      : "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("text-[10px]", cls)}>
      {label}: {text}
    </Badge>
  );
}

function PipelineBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-400">
      {icon}
      {label}
    </span>
  );
}

function Select({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="h-9 max-w-[200px] rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
    >
      {children}
    </select>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
      <Zap className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Aún no hay oportunidades</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Analiza negocios en el Analyzer para detectar oportunidades. Aparecerán aquí
        priorizadas y listas para llevar al MVP Factory.
      </p>
    </div>
  );
}
