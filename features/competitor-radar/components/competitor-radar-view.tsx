"use client";

// features/competitor-radar/components/competitor-radar-view.tsx
// Competitor Radar: uses live web search to find nearby competitors and
// market gaps for an analyzed business.

import { useState, useTransition } from "react";
import {
  Target,
  Sparkles,
  Loader2,
  AlertTriangle,
  Inbox,
  Building2,
  Lightbulb,
  Link2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import { runCompetitorRadarAction } from "@/features/competitor-radar/actions";
import type { CompetitorRadarCandidate, CompetitorRadarReportData } from "@/features/competitor-radar/types";

interface Props {
  initialReports: CompetitorRadarReportData[];
  candidates: CompetitorRadarCandidate[];
  initialPlaceId?: string;
}

export function CompetitorRadarView({ initialReports, candidates, initialPlaceId }: Props) {
  const [reports, setReports] = useState<CompetitorRadarReportData[]>(initialReports);
  const initialSelected =
    initialReports.find((r) => r.placeId === initialPlaceId)?.placeId ?? initialReports[0]?.placeId ?? null;
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialSelected);
  const [error, setError] = useState("");

  const selected = reports.find((r) => r.placeId === selectedPlaceId) ?? null;

  function onSaved(report: CompetitorRadarReportData) {
    setReports((prev) => {
      const exists = prev.some((r) => r.placeId === report.placeId);
      return exists ? prev.map((r) => (r.placeId === report.placeId ? report : r)) : [report, ...prev];
    });
    setSelectedPlaceId(report.placeId);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <Target className="h-4 w-4" />
          Competitor Radar
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Investiga la competencia cercana de un negocio analizado mediante búsqueda web en tiempo
          real y detecta huecos de mercado que NZT Studio podría cubrir.
        </p>
      </div>

      <AiProviderNotice moduleId="competitor-radar" />

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
          <RunForm
            candidates={candidates}
            initialPlaceId={initialPlaceId}
            onSaved={onSaved}
            onError={setError}
          />

          {reports.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Informes generados ({reports.length})
              </h2>
              <div className="space-y-1.5">
                {reports.map((r) => (
                  <ReportListItem
                    key={r.placeId}
                    report={r}
                    selected={r.placeId === selectedPlaceId}
                    onSelect={() => setSelectedPlaceId(r.placeId)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="overflow-y-auto xl:col-span-8">
          {selected ? (
            <ReportPreview report={selected} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">Analiza la competencia para ver el informe aquí.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Run form ───────────────────────────────────────────────────────────────

function RunForm({
  candidates,
  initialPlaceId,
  onSaved,
  onError,
}: {
  candidates: CompetitorRadarCandidate[];
  initialPlaceId?: string;
  onSaved: (report: CompetitorRadarReportData) => void;
  onError: (msg: string) => void;
}) {
  const [placeId, setPlaceId] = useState(
    candidates.find((c) => c.placeId === initialPlaceId)?.placeId ?? candidates[0]?.placeId ?? ""
  );
  const [pending, startTransition] = useTransition();

  const candidate = candidates.find((c) => c.placeId === placeId) ?? null;

  function run() {
    if (!candidate) {
      onError("Selecciona un negocio.");
      return;
    }
    onError("");
    startTransition(async () => {
      const result = await runCompetitorRadarAction(candidate);
      if (result.ok) {
        onSaved(result.data);
      } else {
        onError(result.error);
      }
    });
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Analizar competencia
        </span>

        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no hay negocios analizados. Analiza un negocio en el Rastreador primero.
          </p>
        ) : (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Negocio</label>
            <select
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
            >
              {candidates.map((c) => (
                <option key={c.placeId} value={c.placeId}>
                  {c.businessName}
                  {c.hasReport ? " (informe existente)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={run}
          disabled={pending || candidates.length === 0}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {candidate?.hasReport ? "Reanalizar competencia" : "Analizar competencia"}
        </button>
        {pending && (
          <p className="text-[11px] text-muted-foreground">
            Buscando competidores en internet, puede tardar unos segundos...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── List items ─────────────────────────────────────────────────────────────

function ReportListItem({
  report,
  selected,
  onSelect,
}: {
  report: CompetitorRadarReportData;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
      }`}
    >
      <p className="truncate text-xs font-medium text-foreground">{report.businessName}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {report.competitors.length} competidores · {formatDate(report.updatedAt)}
      </p>
    </button>
  );
}

// ─── Preview ────────────────────────────────────────────────────────────────

function ReportPreview({ report }: { report: CompetitorRadarReportData }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{report.businessName}</h2>
        <p className="text-[11px] text-muted-foreground">Modelo: {report.model} · {formatDate(report.updatedAt)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="space-y-2 p-4">
            <span className="text-sm font-medium text-foreground">Resumen</span>
            <p className="text-xs text-muted-foreground">{report.summary}</p>
          </CardContent>
        </Card>

        {report.gaps.length > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="space-y-2 p-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-emerald-400" />
                Huecos de mercado
              </span>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                {report.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {report.competitors.length > 0 && (
        <section className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Competidores
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {report.competitors.map((c, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{c.name}</p>
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <Link2 className="h-3 w-3" />
                        Web
                      </a>
                    )}
                  </div>
                  {c.strengths.length > 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <ThumbsUp className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                      <span>{c.strengths.join(", ")}</span>
                    </div>
                  )}
                  {c.weaknesses.length > 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <ThumbsDown className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
                      <span>{c.weaknesses.join(", ")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {report.sources.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <span className="text-sm font-medium text-foreground">Fuentes</span>
            <ul className="space-y-1">
              {report.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
