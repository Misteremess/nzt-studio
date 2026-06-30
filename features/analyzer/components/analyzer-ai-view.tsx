"use client";

// features/analyzer/components/analyzer-ai-view.tsx
// Client view for the AI Business Analyzer. Triggers the Claude analysis,
// shows what the business already has, the web research, and the detected
// opportunities — each selectable to flow into the MVP Factory.

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Circle,
  Radar,
  Globe,
  ExternalLink,
  Lightbulb,
  ChevronLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import {
  analyzeBusinessAction,
  toggleOpportunityAction,
} from "@/features/analyzer/actions";
import type {
  BusinessAnalysisData,
  AiOpportunityData,
  OppLevel,
} from "@/features/analyzer/types";

const LEVEL_LABEL: Record<OppLevel, string> = { low: "Bajo", medium: "Medio", high: "Alto" };
const LEVEL_CLASSES: Record<OppLevel, string> = {
  high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

interface Props {
  placeId: string | null;
  businessName: string | null;
  initialAnalysis: BusinessAnalysisData | null;
}

export function AnalyzerAiView({ placeId, businessName, initialAnalysis }: Props) {
  const [analysis, setAnalysis] = useState<BusinessAnalysisData | null>(initialAnalysis);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, startAnalyze] = useTransition();

  // Remember the last analyzed business so the Analyzer reopens it on return.
  useEffect(() => {
    if (placeId) sessionStorage.setItem("analyzer:last", placeId);
  }, [placeId]);

  // ── No business selected ───────────────────────────────────────────────────
  if (!placeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-muted-foreground">
        <Radar className="h-10 w-10 opacity-30" />
        <div>
          <p className="text-sm">No hay ningún negocio seleccionado.</p>
          <p className="text-sm">
            Ve al{" "}
            <Link href="/rastreador" className="text-indigo-400 hover:text-indigo-300">
              Rastreador
            </Link>{" "}
            y pulsa <span className="text-foreground">Analizar con IA</span> en un negocio.
          </p>
        </div>
      </div>
    );
  }

  const name = analysis?.businessName ?? businessName ?? "Negocio";

  function handleAnalyze() {
    if (!placeId) return;
    setError(null);
    startAnalyze(async () => {
      const result = await analyzeBusinessAction(placeId);
      if (result.ok) setAnalysis(result.data);
      else setError(result.error);
    });
  }

  function handleToggle(opp: AiOpportunityData) {
    if (!analysis) return;
    const next = !opp.selected;
    // Optimistic update
    setAnalysis({
      ...analysis,
      opportunities: analysis.opportunities.map((o) =>
        o.id === opp.id ? { ...o, selected: next } : o
      ),
    });
    void toggleOpportunityAction(opp.id, next).then((res) => {
      if (!res.ok) {
        // Revert on failure
        setAnalysis((prev) =>
          prev
            ? {
                ...prev,
                opportunities: prev.opportunities.map((o) =>
                  o.id === opp.id ? { ...o, selected: opp.selected } : o
                ),
              }
            : prev
        );
      }
    });
  }

  const selectedCount = analysis?.opportunities.filter((o) => o.selected).length ?? 0;

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      <AiProviderNotice moduleId="analyzer" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/analyzer?list=1"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Todos los análisis
          </Link>
          <h1 className="text-lg font-semibold text-foreground leading-tight">{name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Análisis de negocio con IA + investigación en internet
          </p>
        </div>
        <Button onClick={handleAnalyze} disabled={isAnalyzing} size="sm">
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analizando...
            </>
          ) : analysis ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-analizar
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Analizar con IA
            </>
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-rose-500/30">
          <CardContent className="p-3">
            <p className="text-sm text-rose-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Empty (not yet analyzed) ──────────────────────────────────────── */}
      {!analysis && !isAnalyzing && !error && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 opacity-30" />
          <p className="text-sm max-w-sm">
            Pulsa <span className="text-foreground">Analizar con IA</span> para que Claude
            investigue este negocio en internet y detecte oportunidades.
          </p>
        </div>
      )}

      {isAnalyzing && !analysis && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Investigando el negocio en internet...</p>
          <p className="text-xs opacity-60">Esto puede tardar hasta un minuto.</p>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {analysis && (
        <div className="space-y-5">
          {/* Summary */}
          {analysis.summary && (
            <section>
              <SectionLabel>Resumen</SectionLabel>
              <p className="text-sm text-foreground/90 leading-relaxed">{analysis.summary}</p>
            </section>
          )}

          {/* Assets — what it already has */}
          {analysis.assets.length > 0 && (
            <section>
              <SectionLabel>Lo que el negocio ya tiene</SectionLabel>
              <ul className="space-y-1.5">
                {analysis.assets.map((asset, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                    <span>{asset}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Web findings */}
          {(analysis.webFindings.text || analysis.webFindings.sources.length > 0) && (
            <section>
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Investigación en internet
                </span>
              </SectionLabel>
              {analysis.webFindings.text && (
                <p className="text-sm text-foreground/80 leading-relaxed mb-2">
                  {analysis.webFindings.text}
                </p>
              )}
              {analysis.webFindings.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.webFindings.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-md px-2 py-1 max-w-[16rem] truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          <Separator />

          {/* Opportunities */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Oportunidades detectadas ({analysis.opportunities.length})
                </span>
              </SectionLabel>
              {selectedCount > 0 && (
                <span className="text-xs text-indigo-400">
                  {selectedCount} seleccionada{selectedCount === 1 ? "" : "s"} → MVP Factory
                </span>
              )}
            </div>

            {analysis.opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No se detectaron oportunidades para este negocio.
              </p>
            ) : (
              <div className="space-y-2.5">
                {analysis.opportunities.map((opp) => (
                  <OpportunityCard key={opp.id} opp={opp} onToggle={() => handleToggle(opp)} />
                ))}
              </div>
            )}
          </section>

          <p className="text-[10px] text-muted-foreground/40 text-center pt-1">
            Generado por {analysis.model} · investigación web en vivo
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function LevelBadge({ label, level }: { label: string; level: OppLevel | null }) {
  if (!level) return null;
  return (
    <Badge variant="outline" className={cn("text-xs", LEVEL_CLASSES[level])}>
      {label}: {LEVEL_LABEL[level]}
    </Badge>
  );
}

function OpportunityCard({
  opp,
  onToggle,
}: {
  opp: AiOpportunityData;
  onToggle: () => void;
}) {
  return (
    <Card className={cn("transition-colors", opp.selected ? "border-indigo-500/50 bg-indigo-500/[0.03]" : "border-border/50")}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground leading-snug">{opp.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <LevelBadge label="Impacto" level={opp.impact} />
            <LevelBadge label="Esfuerzo" level={opp.effort} />
          </div>
        </div>

        {opp.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{opp.description}</p>
        )}

        {opp.development && (
          <div className="pt-1.5 border-t border-border/40">
            <p className="text-xs leading-relaxed text-foreground/70">
              <span className="font-medium text-indigo-400/90">Qué podríamos hacer: </span>
              {opp.development}
            </p>
          </div>
        )}

        <Button
          variant={opp.selected ? "default" : "outline"}
          size="sm"
          className="w-full mt-1"
          onClick={onToggle}
        >
          {opp.selected ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Seleccionada para MVP
            </>
          ) : (
            <>
              <Circle className="h-4 w-4 mr-2" />
              Seleccionar para MVP
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
