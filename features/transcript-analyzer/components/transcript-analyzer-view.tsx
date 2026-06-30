"use client";

// features/transcript-analyzer/components/transcript-analyzer-view.tsx
// Transcript Analyzer: paste a call/meeting transcript and get a summary,
// requirements, objections, action items and overall sentiment.

import { useState, useTransition } from "react";
import {
  AudioLines,
  Sparkles,
  Loader2,
  AlertTriangle,
  Archive,
  RotateCcw,
  Trash2,
  Inbox,
  ListChecks,
  ShieldQuestion,
  ArrowRight,
  Smile,
  Meh,
  Frown,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import {
  analyzeTranscriptAction,
  archiveTranscriptAnalysisAction,
  deleteTranscriptAnalysisAction,
  listTranscriptAnalysesAction,
  restoreTranscriptAnalysisAction,
} from "@/features/transcript-analyzer/actions";
import type { Sentiment, TranscriptAnalysisData } from "@/features/transcript-analyzer/types";

interface Props {
  initialAnalyses: TranscriptAnalysisData[];
}

export function TranscriptAnalyzerView({ initialAnalyses }: Props) {
  const [analyses, setAnalyses] = useState<TranscriptAnalysisData[]>(initialAnalyses);
  const [selectedId, setSelectedId] = useState<string | null>(initialAnalyses[0]?.id ?? null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<TranscriptAnalysisData[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const selected = analyses.find((a) => a.id === selectedId) ?? null;

  function onSaved(analysis: TranscriptAnalysisData) {
    setAnalyses((prev) => [analysis, ...prev]);
    setSelectedId(analysis.id);
  }

  function onArchive(id: string) {
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  async function toggleArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const r = await listTranscriptAnalysesAction(true);
      if (r.ok) setArchived(r.data);
      setLoadingArchived(false);
    }
    setShowArchived((v) => !v);
  }

  function onRestore(id: string) {
    setArchived((prev) => prev.filter((a) => a.id !== id));
    listTranscriptAnalysesAction().then((r) => {
      if (r.ok) setAnalyses(r.data);
    });
  }

  function onDelete(id: string) {
    setArchived((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <AudioLines className="h-4 w-4" />
          Transcript Analyzer
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pega la transcripción de una llamada o reunión y obtén un resumen, requisitos
          mencionados, objeciones, próximos pasos y sentimiento general.
        </p>
      </div>

      <AiProviderNotice moduleId="transcript-analyzer" />

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
          <AnalyzeForm onSaved={onSaved} onError={setError} />

          {analyses.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Análisis recientes ({analyses.length})
              </h2>
              <div className="space-y-1.5">
                {analyses.map((a) => (
                  <AnalysisListItem
                    key={a.id}
                    analysis={a}
                    selected={a.id === selectedId}
                    onSelect={() => setSelectedId(a.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <div>
            <button
              onClick={toggleArchived}
              disabled={loadingArchived}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {loadingArchived ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {showArchived ? "Ocultar archivados" : "Ver archivados"}
            </button>
          </div>

          {showArchived && (
            <section className="space-y-2">
              {archived.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay análisis archivados.</p>
              ) : (
                archived.map((a) => (
                  <ArchivedAnalysisCard key={a.id} analysis={a} onRestored={onRestore} onDeleted={onDelete} />
                ))
              )}
            </section>
          )}
        </div>

        <div className="overflow-y-auto xl:col-span-8">
          {selected ? (
            <AnalysisPreview analysis={selected} onArchived={onArchive} onError={setError} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">Pega una transcripción y analízala para verla aquí.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Analyze form ───────────────────────────────────────────────────────────

function AnalyzeForm({
  onSaved,
  onError,
}: {
  onSaved: (analysis: TranscriptAnalysisData) => void;
  onError: (msg: string) => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pending, startTransition] = useTransition();

  function analyze() {
    onError("");
    startTransition(async () => {
      const result = await analyzeTranscriptAction({ businessName, transcript });
      if (result.ok) {
        onSaved(result.data);
        setTranscript("");
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
          Analizar transcripción
        </span>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Negocio (opcional)</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Nombre del negocio"
            className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Transcripción</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Pega aquí la transcripción de la llamada o reunión..."
            rows={10}
            className="w-full resize-y rounded-md border border-border bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <p className="text-[11px] text-muted-foreground">{transcript.trim().length} caracteres (mínimo 50)</p>
        </div>

        <button
          onClick={analyze}
          disabled={pending || transcript.trim().length < 50}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Analizar
        </button>
      </CardContent>
    </Card>
  );
}

// ─── List items ─────────────────────────────────────────────────────────────

function AnalysisListItem({
  analysis,
  selected,
  onSelect,
}: {
  analysis: TranscriptAnalysisData;
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
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-foreground">{analysis.businessName ?? "Sin nombre"}</p>
        <SentimentBadge sentiment={analysis.sentiment} />
      </div>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{analysis.summary}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(analysis.createdAt)}</p>
    </button>
  );
}

function ArchivedAnalysisCard({
  analysis,
  onRestored,
  onDeleted,
}: {
  analysis: TranscriptAnalysisData;
  onRestored: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [isRestoring, startRestore] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleRestore() {
    startRestore(async () => {
      const result = await restoreTranscriptAnalysisAction(analysis.id);
      if (result.ok) onRestored(analysis.id);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteTranscriptAnalysisAction(analysis.id);
      if (result.ok) onDeleted(analysis.id);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-zinc-700 px-3 py-2">
      <p className="truncate text-xs text-foreground/60">
        {analysis.businessName ?? "Sin nombre"} · {formatDate(analysis.createdAt)}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={handleRestore}
          disabled={isRestoring}
          title="Restaurar"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          title="Eliminar"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-400"
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ─── Preview ────────────────────────────────────────────────────────────────

function AnalysisPreview({
  analysis,
  onArchived,
  onError,
}: {
  analysis: TranscriptAnalysisData;
  onArchived: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [isArchiving, startArchive] = useTransition();

  function handleArchive() {
    startArchive(async () => {
      const result = await archiveTranscriptAnalysisAction(analysis.id);
      if (result.ok) onArchived(analysis.id);
      else onError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{analysis.businessName ?? "Análisis de transcripción"}</h2>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(analysis.createdAt)} · Modelo: {analysis.model}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SentimentBadge sentiment={analysis.sentiment} />
          <button
            onClick={handleArchive}
            disabled={isArchiving}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {isArchiving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
            Archivar
          </button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="space-y-2 p-4">
          <span className="text-sm font-medium text-foreground">Resumen de la conversación</span>
          <p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Section icon={<ListChecks className="h-3.5 w-3.5" />} title="Requisitos mencionados" items={analysis.requirements} />

        {analysis.objections.length > 0 && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <ShieldQuestion className="h-3.5 w-3.5" />
                Objeciones
              </span>
              <div className="space-y-2.5">
                {analysis.objections.map((o, i) => (
                  <div key={i} className="rounded-md border border-border/60 p-2.5">
                    <p className="text-xs font-medium text-foreground">{o.objection}</p>
                    {o.response && (
                      <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                        {o.response}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Section icon={<ArrowRight className="h-3.5 w-3.5" />} title="Próximos pasos" items={analysis.actionItems} ordered />
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  items,
  ordered,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const ListTag = ordered ? "ol" : "ul";
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          {icon}
          {title}
        </span>
        <ListTag className={`space-y-1.5 text-xs text-muted-foreground ${ordered ? "list-decimal pl-4" : "list-disc pl-4"}`}>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ListTag>
      </CardContent>
    </Card>
  );
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const meta: Record<Sentiment, { label: string; icon: React.ReactNode; className: string }> = {
    positive: { label: "Positivo", icon: <Smile className="h-3 w-3" />, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    neutral: { label: "Neutral", icon: <Meh className="h-3 w-3" />, className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
    negative: { label: "Negativo", icon: <Frown className="h-3 w-3" />, className: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
  };
  const m = meta[sentiment];
  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1 text-[11px] ${m.className}`}>
      {m.icon}
      {m.label}
    </Badge>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
