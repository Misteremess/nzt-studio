"use client";

// features/mvp-factory/components/mvp-factory-view.tsx
// MVP Factory inbox: opportunities marked "→ MVP Factory" in the Analyzer,
// grouped by business. Each can be turned into a full MVP spec by Claude,
// then read inline or copied as Markdown.

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Lightbulb,
  Check,
  Copy,
  Layers,
  Wrench,
  Map as MapIcon,
  Clock,
  Target,
  Bot,
  Download,
  ImageIcon,
  Globe,
  ChevronDown,
  ChevronUp,
  Archive,
  RotateCcw,
  Trash2,
  X,
  ChevronsDownUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import {
  generateMvpSpecAction,
  generateMvpImagesAction,
  generateMvpHtmlMockupAction,
  archiveMvpSpecAction,
  restoreMvpSpecAction,
  deleteMvpSpecAction,
  listFactoryAction,
} from "@/features/mvp-factory/actions";
import { MvpHtmlPreview } from "@/features/mvp-factory/components/mvp-html-preview";
import { BrandIdentitySection } from "@/features/mvp-factory/components/brand-identity-section";
import {
  specToMarkdown,
  buildClaudePrompt,
  buildLovablePrompt,
} from "@/features/mvp-factory/lib/markdown";
import type { MvpDesignImage } from "@/features/mvp-factory/lib/images";
import type {
  Complexity,
  FactoryBusiness,
  FactoryOpportunity,
  MvpSpecData,
} from "@/features/mvp-factory/types";
import type { OppLevel } from "@/features/analyzer/types";

const LEVEL_LABEL: Record<OppLevel, string> = { low: "Bajo", medium: "Medio", high: "Alto" };
const LEVEL_CLASSES: Record<OppLevel, string> = {
  high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};
const COMPLEXITY_LABEL: Record<Complexity, string> = { low: "Baja", medium: "Media", high: "Alta" };

interface Props {
  initialBusinesses: FactoryBusiness[];
}

export function MvpFactoryView({ initialBusinesses }: Props) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedBusinesses, setArchivedBusinesses] = useState<FactoryBusiness[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, startDeleteSelected] = useTransition();

  const totalOpps = businesses.reduce((n, b) => n + b.opportunities.length, 0);
  const specCount = businesses.reduce((n, b) => n + b.opportunities.filter((o) => o.spec).length, 0);

  function handleSpecGenerated(opportunityId: string, spec: MvpSpecData) {
    setBusinesses((prev) =>
      prev.map((b) => ({
        ...b,
        opportunities: b.opportunities.map((o) => o.id === opportunityId ? { ...o, spec } : o),
      }))
    );
  }

  function handleSpecArchived(opportunityId: string) {
    setBusinesses((prev) =>
      prev
        .map((b) => ({ ...b, opportunities: b.opportunities.filter((o) => o.id !== opportunityId) }))
        .filter((b) => b.opportunities.length > 0)
    );
  }

  function removeFromArchived(oppId: string) {
    setArchivedBusinesses((prev) =>
      prev
        .map((biz) => ({ ...biz, opportunities: biz.opportunities.filter((o) => o.id !== oppId) }))
        .filter((biz) => biz.opportunities.length > 0)
    );
  }

  async function handleToggleArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const result = await listFactoryAction(true);
      if (result.ok) setArchivedBusinesses(result.data);
      setLoadingArchived(false);
    } else {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
    setShowArchived((v) => !v);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDeleteSelected() {
    const allArchived = archivedBusinesses.flatMap((b) => b.opportunities);
    startDeleteSelected(async () => {
      for (const oppId of selectedIds) {
        const opp = allArchived.find((o) => o.id === oppId);
        if (opp?.spec) await deleteMvpSpecAction(opp.spec.id);
      }
      setArchivedBusinesses((prev) =>
        prev
          .map((biz) => ({ ...biz, opportunities: biz.opportunities.filter((o) => !selectedIds.has(o.id)) }))
          .filter((biz) => biz.opportunities.length > 0)
      );
      setSelectedIds(new Set());
      setSelectMode(false);
    });
  }

  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto">
      <AiProviderNotice moduleId="mvp-factory" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-tight">MVP Factory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalOpps > 0
              ? `${totalOpps} oportunidad${totalOpps === 1 ? "" : "es"} seleccionada${totalOpps === 1 ? "" : "s"} · ${specCount} con spec generada`
              : "Marca oportunidades en el Analyzer para convertirlas en MVPs."}
          </p>
        </div>
        {specCount > 0 && (
          <button
            type="button"
            onClick={() => setCollapseSignal((s) => s + 1)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            Colapsar todos
          </button>
        )}
      </div>

      {businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 opacity-30" />
          <p className="text-sm max-w-sm">
            Aún no hay oportunidades seleccionadas. Ve al{" "}
            <Link href="/analyzer" className="text-indigo-400 hover:text-indigo-300">Analyzer</Link>{" "}
            y pulsa <span className="text-foreground">Seleccionar para MVP</span> en una oportunidad.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {businesses.map((b) => (
            <section key={b.placeId} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{b.businessName}</h2>
                <Link
                  href={`/analyzer?placeId=${encodeURIComponent(b.placeId)}`}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Ver análisis
                </Link>
              </div>
              <BrandIdentitySection
                placeId={b.placeId}
                websiteUri={b.websiteUri}
                brandIdentity={b.brandIdentity}
              />
              <div className="space-y-3">
                {b.opportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    businessName={b.businessName}
                    opp={opp}
                    onSpecGenerated={handleSpecGenerated}
                    onArchived={handleSpecArchived}
                    collapseSignal={collapseSignal}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Card management row */}
      <div className="mt-2 flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={handleToggleArchived}
          disabled={loadingArchived}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {loadingArchived ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
          {showArchived ? "Ocultar archivados" : "Ver archivados"}
        </button>
      </div>

      {showArchived && (
        <div className="space-y-3">
          {archivedBusinesses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay specs archivadas.</p>
          ) : (
            <>
              {/* Archived section toolbar */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selectMode ? "Cancelar selección" : "Seleccionar"}
                </button>
                {selectMode && selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={isDeletingSelected}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    {isDeletingSelected ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Eliminar seleccionados ({selectedIds.size})
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {archivedBusinesses.map((b) => (
                  <section key={b.placeId} className="space-y-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{b.businessName}</h2>
                    <div className="space-y-2">
                      {b.opportunities.map((opp) => (
                        <ArchivedSpecCard
                          key={opp.id}
                          opp={opp}
                          selectMode={selectMode}
                          isSelected={selectedIds.has(opp.id)}
                          onToggleSelect={toggleSelect}
                          onRestored={(oppId) => {
                            removeFromArchived(oppId);
                            listFactoryAction().then((r) => { if (r.ok) setBusinesses(r.data); });
                          }}
                          onDeleted={removeFromArchived}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Opportunity card ─────────────────────────────────────────────────────────

function OpportunityCard({
  businessName,
  opp,
  onSpecGenerated,
  onArchived,
  collapseSignal,
}: {
  businessName: string;
  opp: FactoryOpportunity;
  onSpecGenerated: (opportunityId: string, spec: MvpSpecData) => void;
  onArchived?: (opportunityId: string) => void;
  collapseSignal: number;
}) {
  const storageKey = `nzt-mvp-card-${opp.id}`;
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "true";
  });
  const [confirming, setConfirming] = useState(false);
  const [isGenerating, startGenerate] = useTransition();
  const [isArchiving, startArchive] = useTransition();

  // "Colapsar todo" del padre: estado derivado durante el render (patrón React
  // para reaccionar a cambios de props sin un setState en cascada en un efecto).
  const [prevCollapseSignal, setPrevCollapseSignal] = useState(collapseSignal);
  if (collapseSignal !== prevCollapseSignal) {
    setPrevCollapseSignal(collapseSignal);
    if (collapseSignal > 0 && opp.spec) setCollapsed(true);
  }

  // Persiste el colapso cuando cambia (la escritura en localStorage es un
  // efecto externo, no puede ir en el bloque de render de arriba).
  useEffect(() => {
    if (collapsed) localStorage.setItem(storageKey, "true");
  }, [collapsed, storageKey]);

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const result = await generateMvpSpecAction(opp.id);
      if (result.ok) { onSpecGenerated(opp.id, result.data); setCollapsed(false); localStorage.removeItem(storageKey); }
      else setError(result.error);
    });
  }

  function handleArchive() {
    if (!opp.spec) return;
    startArchive(async () => {
      const result = await archiveMvpSpecAction(opp.spec!.id);
      if (result.ok) onArchived?.(opp.id);
      setConfirming(false);
    });
  }

  return (
    <div className={cn("rounded-lg border flex overflow-hidden", opp.spec ? "border-indigo-500/70" : "border-border")}>
      {/* Left mini-menu */}
      {opp.spec && (
        <div className="flex flex-col items-center gap-1 border-r border-border bg-muted/5 px-1 py-2 shrink-0">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-7 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground rounded hover:bg-accent transition-colors"
            title="Archivar spec"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => { localStorage.setItem(storageKey, String(!v)); return !v; })}
            className="h-7 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground rounded hover:bg-accent transition-colors"
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      {/* Card content */}
      <div className="flex-1 min-w-0 p-3.5 space-y-3">
        {confirming && (
          <div className="flex items-center gap-2 rounded bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5">
            <span className="text-[11px] text-rose-300/80 flex-1">¿Archivar esta spec?</span>
            <button type="button" onClick={handleArchive} disabled={isArchiving} className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded hover:bg-rose-500/10 transition-colors">
              {isArchiving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí, archivar"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors">
              Cancelar
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug inline-flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              {opp.title}
            </p>
            {opp.description && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">{opp.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <LevelBadge label="Impacto" level={opp.impact} />
            <LevelBadge label="Esfuerzo" level={opp.effort} />
          </div>
        </div>

        {opp.spec && collapsed && (
          <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground italic">
            &ldquo;{opp.spec.pitch}&rdquo;
            {opp.spec.timeline && <span className="ml-2 not-italic text-foreground/60">· {opp.spec.timeline}</span>}
            {opp.spec.complexity && <span className="ml-1 not-italic text-foreground/60">· {COMPLEXITY_LABEL[opp.spec.complexity]}</span>}
          </div>
        )}

        {!collapsed && (
          <>
            {!opp.spec ? (
              <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="w-full">
                {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando spec...</> : <><Sparkles className="h-4 w-4 mr-2" />Generar MVP con IA</>}
              </Button>
            ) : (
              <SpecView businessName={businessName} opp={opp} spec={opp.spec} onRegenerate={handleGenerate} regenerating={isGenerating} />
            )}
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Archived spec card ───────────────────────────────────────────────────────

function ArchivedSpecCard({
  opp,
  onRestored,
  onDeleted,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  opp: FactoryOpportunity;
  onRestored: (oppId: string) => void;
  onDeleted: (oppId: string) => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (oppId: string) => void;
}) {
  const [isRestoring, startRestore] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleRestore() {
    if (!opp.spec) return;
    startRestore(async () => {
      const result = await restoreMvpSpecAction(opp.spec!.id);
      if (result.ok) onRestored(opp.id);
    });
  }

  function handleDelete() {
    if (!opp.spec) return;
    startDelete(async () => {
      const result = await deleteMvpSpecAction(opp.spec!.id);
      if (result.ok) onDeleted(opp.id);
      setConfirmDelete(false);
    });
  }

  return (
    <div className="flex rounded-lg border border-dashed border-zinc-700 overflow-hidden">
      {/* Left: checkbox (select mode) or delete icon */}
      <div className="flex flex-col items-center justify-center border-r border-border/40 bg-muted/5 px-1 py-2 shrink-0 w-8">
        {selectMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(opp.id)}
            className="accent-indigo-500 cursor-pointer h-3.5 w-3.5"
          />
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
      {/* Content */}
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground/60 leading-snug inline-flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400/40 shrink-0" />
              {opp.title}
            </p>
            {opp.spec && <p className="text-xs text-muted-foreground/70 italic mt-0.5 line-clamp-1">&ldquo;{opp.spec.pitch}&rdquo;</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400/80">Archivado</Badge>
            {opp.spec && (
              <button type="button" onClick={handleRestore} disabled={isRestoring} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border/60 rounded px-2 py-1 hover:bg-accent transition-colors">
                {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCcw className="h-3 w-3" />Restaurar</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Spec rendering ─────────────────────────────────────────────────────────

function SpecView({
  businessName,
  opp,
  spec,
  onRegenerate,
  regenerating,
}: {
  businessName: string;
  opp: FactoryOpportunity;
  spec: MvpSpecData;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const claudePrompt = buildClaudePrompt(businessName, opp.title, spec);
  const lovablePrompt = buildLovablePrompt(businessName, opp.title, spec);

  function handleCopy() {
    copyToClipboard(specToMarkdown(businessName, opp.title, spec), () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 items-start lg:grid-cols-2">
    <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3.5 min-w-0">
      <p className="text-sm text-foreground/90 italic leading-relaxed">“{spec.pitch}”</p>

      <SpecBlock label="Problema">{spec.problem}</SpecBlock>
      <SpecBlock label="Solución">{spec.solution}</SpecBlock>
      <SpecBlock label="Usuario objetivo" icon={<Target className="h-3.5 w-3.5" />}>
        {spec.targetUser}
      </SpecBlock>

      {spec.coreFeatures.length > 0 && (
        <SpecList label="Features del MVP" icon={<Layers className="h-3.5 w-3.5" />} items={spec.coreFeatures} accent />
      )}
      {spec.futureFeatures.length > 0 && (
        <SpecList label="Mejoras posteriores" items={spec.futureFeatures} />
      )}
      {spec.techStack.length > 0 && (
        <div>
          <SpecLabel icon={<Wrench className="h-3.5 w-3.5" />}>Stack</SpecLabel>
          <div className="flex flex-wrap gap-1.5">
            {spec.techStack.map((t, i) => (
              <Badge key={i} variant="outline" className="text-[11px] bg-secondary/40">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {spec.phases.length > 0 && (
        <div>
          <SpecLabel icon={<MapIcon className="h-3.5 w-3.5" />}>Roadmap</SpecLabel>
          <ol className="space-y-2">
            {spec.phases.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-medium text-indigo-300">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-foreground/80">{spec.timeline}</span>
        {spec.complexity && (
          <span className="opacity-70">· Complejidad {COMPLEXITY_LABEL[spec.complexity]}</span>
        )}
      </div>

      <Separator />

      <PromptBox
        icon={<Bot className="h-3.5 w-3.5" />}
        label="Prompt para Claude"
        description="Prompt profesional adaptado al negocio para construir este MVP en Claude."
        prompt={claudePrompt}
      />

      <PromptBox
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Prompt para Lovable"
        description="Brief listo para pegar en Lovable y generar la app (React + Tailwind + Supabase)."
        prompt={lovablePrompt}
      />

      <DesignImages businessName={businessName} opp={opp} />

      <div className="flex items-center gap-2">
        <Button onClick={handleCopy} variant="outline" size="sm" className="flex-1">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2 text-emerald-400" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copiar Markdown
            </>
          )}
        </Button>
        <Button onClick={onRegenerate} disabled={regenerating} variant="ghost" size="sm">
          {regenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>

    <div className="lg:sticky lg:top-3">
      <HtmlMockupSection businessName={businessName} opp={opp} spec={spec} />
    </div>
    </div>
  );
}

// ─── Prompt box (Claude / Lovable) ────────────────────────────────────────────

function copyToClipboard(text: string, onDone: () => void) {
  navigator.clipboard
    .writeText(text)
    .then(onDone)
    .catch(() => {
      // Clipboard can be denied (e.g. no user gesture). Fail silently.
    });
}

function PromptBox({
  icon,
  label,
  description,
  prompt,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  prompt: string;
}) {
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-300 inline-flex items-center gap-1.5">
          {icon}
          {label}
        </p>
        <Button
          onClick={() =>
            copyToClipboard(prompt, () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            })
          }
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-300 hover:text-indigo-200"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar prompt
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors"
      >
        {show ? "Ocultar prompt" : "Ver prompt"}
      </button>
      {show && (
        <pre className="max-h-64 overflow-y-auto rounded-md border border-border bg-background/60 p-2.5 text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {prompt}
        </pre>
      )}
    </div>
  );
}

// ─── Branded design mockups (OpenAI) ──────────────────────────────────────────

function DesignImages({
  businessName,
  opp,
}: {
  businessName: string;
  opp: FactoryOpportunity;
}) {
  const [images, setImages] = useState<MvpDesignImage[]>(opp.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const result = await generateMvpImagesAction(opp.id);
      if (result.ok) setImages(result.data);
      else setError(result.error);
    });
  }

  function handleDownload(img: MvpDesignImage) {
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${img.b64}`;
    a.download = `${slug || "mvp"}-${img.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-fuchsia-300 inline-flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          Diseños de la web
        </p>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-fuchsia-300 hover:text-fuchsia-200"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {images.length > 0 ? "Regenerar" : "Generar diseños"}
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Mockups de la web con la marca del negocio (hero, features y página interior). Generados con OpenAI.
      </p>

      {isGenerating && images.length === 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="aspect-[3/2] animate-pulse rounded-md border border-border bg-secondary/40"
            />
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {images.map((img) => (
            <figure key={img.id} className="group relative overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${img.b64}`}
                alt={`${img.label} — ${businessName}`}
                className="aspect-[3/2] w-full object-cover"
              />
              <figcaption className="flex items-center justify-between gap-2 bg-background/80 px-2 py-1.5">
                <span className="truncate text-[11px] text-muted-foreground">{img.label}</span>
                <button
                  type="button"
                  onClick={() => handleDownload(img)}
                  className="shrink-0 text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
                  aria-label={`Descargar ${img.label}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ─── AI HTML landing mockup ───────────────────────────────────────────────────

function HtmlMockupSection({
  businessName,
  opp,
  spec,
}: {
  businessName: string;
  opp: FactoryOpportunity;
  spec: MvpSpecData;
}) {
  const [htmlMockup, setHtmlMockup] = useState<string | null>(spec.htmlMockup);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const result = await generateMvpHtmlMockupAction(opp.id);
      if (result.ok) setHtmlMockup(result.data.htmlMockup);
      else setError(result.error);
    });
  }

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-cyan-300 inline-flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" />
          Mockup web del MVP
        </p>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-cyan-300 hover:text-cyan-200"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {htmlMockup ? "Regenerar" : "Generar mockup web"}
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Landing page funcional generada por IA para enseñar el MVP al negocio.
      </p>

      {isGenerating && !htmlMockup && (
        <div className="aspect-video animate-pulse rounded-md border border-border bg-secondary/40" />
      )}

      {htmlMockup && <MvpHtmlPreview html={htmlMockup} businessName={businessName} />}

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────

function SpecLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 inline-flex items-center gap-1.5">
      {icon}
      {children}
    </p>
  );
}

function SpecBlock({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <SpecLabel icon={icon}>{label}</SpecLabel>
      <p className="text-xs text-foreground/85 leading-relaxed">{children}</p>
    </div>
  );
}

function SpecList({
  label,
  icon,
  items,
  accent,
}: {
  label: string;
  icon?: React.ReactNode;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div>
      <SpecLabel icon={icon}>{label}</SpecLabel>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground/85 leading-relaxed">
            <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", accent ? "bg-indigo-400" : "bg-muted-foreground/50")} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelBadge({ label, level }: { label: string; level: OppLevel | null }) {
  if (!level) return null;
  return (
    <Badge variant="outline" className={cn("text-[11px]", LEVEL_CLASSES[level])}>
      {label}: {LEVEL_LABEL[level]}
    </Badge>
  );
}
