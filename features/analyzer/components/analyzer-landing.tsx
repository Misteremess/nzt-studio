"use client";

// features/analyzer/components/analyzer-landing.tsx
// Landing for /analyzer when no business is selected. Auto-reopens the last
// analyzed business (remembered in sessionStorage); otherwise shows a listing
// of all past analyses.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, Fragment } from "react";
import {
  Loader2,
  Sparkles,
  Lightbulb,
  Radar,
  ChevronRight,
  Archive,
  RotateCcw,
  Trash2,
  Check,
  X,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  archiveAnalysisAction,
  restoreAnalysisAction,
  deleteAnalysisAction,
  listAnalysesAction,
} from "@/features/analyzer/actions";
import type { AnalysisListItem } from "@/features/analyzer/types";

interface Props {
  analyses: AnalysisListItem[];
  forceList: boolean;
}

export function AnalyzerLanding({ analyses: initialAnalyses, forceList }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(!forceList);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedAnalyses, setArchivedAnalyses] = useState<AnalysisListItem[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, startDeleteSelected] = useTransition();

  useEffect(() => {
    if (forceList) return;
    const last = sessionStorage.getItem("analyzer:last");
    if (last && analyses.some((a) => a.placeId === last)) {
      router.replace(`/analyzer?placeId=${encodeURIComponent(last)}`);
    } else {
      setChecking(false);
    }
  }, [forceList, analyses, router]);

  async function handleToggleArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const result = await listAnalysesAction(true);
      if (result.ok) setArchivedAnalyses(result.data);
      setLoadingArchived(false);
    } else {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
    setShowArchived((v) => !v);
  }

  function toggleSelect(placeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId); else next.add(placeId);
      return next;
    });
  }

  function handleDeleteSelected() {
    startDeleteSelected(async () => {
      for (const placeId of selectedIds) {
        await deleteAnalysisAction(placeId);
      }
      setArchivedAnalyses((prev) => prev.filter((a) => !selectedIds.has(a.placeId)));
      setSelectedIds(new Set());
      setSelectMode(false);
    });
  }

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      <div>
        <h1 className="text-lg font-semibold text-foreground leading-tight">Análisis de negocio</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {analyses.length > 0
            ? "Selecciona un análisis previo o analiza un negocio nuevo desde el Rastreador."
            : "Aún no hay análisis. Empieza desde el Rastreador."}
        </p>
      </div>

      {analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 opacity-30" />
          <p className="text-sm max-w-sm">
            Ve al{" "}
            <Link href="/rastreador" className="text-indigo-400 hover:text-indigo-300">
              Rastreador
            </Link>{" "}
            y pulsa <span className="text-foreground">Analizar con IA</span> en un negocio.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {analyses.map((a) => (
            <AnalysisCard
              key={a.placeId}
              analysis={a}
              onArchived={(placeId) =>
                setAnalyses((prev) => prev.filter((x) => x.placeId !== placeId))
              }
            />
          ))}
        </div>
      )}

      {/* Archived section */}
      <div className="mt-auto pt-2 space-y-2.5">
        <button
          type="button"
          onClick={handleToggleArchived}
          disabled={loadingArchived}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {loadingArchived ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
          {showArchived ? "Ocultar archivados" : "Ver archivados"}
        </button>

        {showArchived && (
          <div className="space-y-2.5">
            {archivedAnalyses.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay análisis archivados.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {selectMode ? "Cancelar selección" : "Seleccionar"}
                  </button>
                  {selectMode && selectedIds.size > 0 && (
                    <button type="button" onClick={handleDeleteSelected} disabled={isDeletingSelected} className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors">
                      {isDeletingSelected ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Eliminar seleccionados ({selectedIds.size})
                    </button>
                  )}
                </div>
                {archivedAnalyses.map((a) => (
                  <ArchivedAnalysisCard
                    key={a.placeId}
                    analysis={a}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(a.placeId)}
                    onToggleSelect={toggleSelect}
                    onRestored={(placeId) => {
                      setArchivedAnalyses((prev) => prev.filter((x) => x.placeId !== placeId));
                      listAnalysesAction().then((r) => { if (r.ok) setAnalyses(r.data); });
                    }}
                    onDeleted={(placeId) => setArchivedAnalyses((prev) => prev.filter((x) => x.placeId !== placeId))}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <Link
        href="/rastreador"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pb-2"
      >
        <Radar className="h-3.5 w-3.5" />
        Analizar un negocio nuevo en el Rastreador
      </Link>
    </div>
  );
}

// ─── Active analysis card ─────────────────────────────────────────────────────

function AnalysisCard({
  analysis: a,
  onArchived,
}: {
  analysis: AnalysisListItem;
  onArchived: (placeId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, start] = useTransition();

  function handleArchive() {
    start(async () => {
      const result = await archiveAnalysisAction(a.placeId);
      if (result.ok) onArchived(a.placeId);
      setConfirming(false);
    });
  }

  return (
    <div className="flex rounded-lg border border-border overflow-hidden hover:border-indigo-500/40 transition-colors">
      {/* Left mini-menu */}
      <div className="flex flex-col items-center justify-start gap-1 border-r border-border bg-muted/5 px-1 py-2 shrink-0">
        {confirming ? (
          <>
            <button type="button" onClick={handleArchive} disabled={isPending} title="Confirmar archivo" className="h-6 w-6 flex items-center justify-center text-rose-400 hover:text-rose-300 rounded hover:bg-rose-500/10 transition-colors">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => setConfirming(false)} title="Cancelar" className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors">
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} title="Archivar análisis" className="h-7 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground rounded hover:bg-accent transition-colors">
            <Archive className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {/* Card content — navigates to analysis */}
      <Link href={`/analyzer?placeId=${encodeURIComponent(a.placeId)}`} className="flex-1 min-w-0">
        <div className="p-3 hover:bg-indigo-500/[0.02] transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug truncate">{a.businessName}</p>
              {a.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">{a.summary}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  {a.opportunityCount} oportunidad{a.opportunityCount === 1 ? "" : "es"}
                </span>
                {a.selectedCount > 0 && <span className="text-indigo-400">{a.selectedCount} → MVP Factory</span>}
                <span className="opacity-60">{formatDate(a.updatedAt)}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Archived analysis card ───────────────────────────────────────────────────

function ArchivedAnalysisCard({
  analysis: a,
  onRestored,
  onDeleted,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  analysis: AnalysisListItem;
  onRestored: (placeId: string) => void;
  onDeleted: (placeId: string) => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (placeId: string) => void;
}) {
  const [isRestoring, startRestore] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleRestore() {
    startRestore(async () => {
      const result = await restoreAnalysisAction(a.placeId);
      if (result.ok) onRestored(a.placeId);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteAnalysisAction(a.placeId);
      if (result.ok) onDeleted(a.placeId);
      setConfirmDelete(false);
    });
  }

  return (
    <div className="flex rounded-lg border border-dashed border-zinc-700 overflow-hidden">
      <div className="flex flex-col items-center justify-center border-r border-border/40 bg-muted/5 px-1 py-2 shrink-0 w-8">
        {selectMode ? (
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(a.placeId)} className="accent-indigo-500 cursor-pointer h-3.5 w-3.5" />
        ) : confirmDelete ? (
          <>
            <button type="button" onClick={handleDelete} disabled={isDeleting} title="Confirmar" className="h-6 w-6 flex items-center justify-center text-rose-400 hover:text-rose-300 rounded hover:bg-rose-500/10 transition-colors">
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} title="Cancelar" className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors">
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} title="Eliminar permanentemente" className="h-7 w-6 flex items-center justify-center text-muted-foreground/40 hover:text-rose-400 rounded hover:bg-accent transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground/60 leading-snug truncate">{a.businessName}</p>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400/80 shrink-0">Archivado</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/60">
              <span>{a.opportunityCount} oportunidad{a.opportunityCount === 1 ? "" : "es"}</span>
              <span>{formatDate(a.updatedAt)}</span>
            </div>
          </div>
          <button type="button" onClick={handleRestore} disabled={isRestoring} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border/60 rounded px-2 py-1 hover:bg-accent transition-colors shrink-0">
            {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCcw className="h-3 w-3" />Restaurar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
