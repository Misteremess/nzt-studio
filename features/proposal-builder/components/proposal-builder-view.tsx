"use client";

// features/proposal-builder/components/proposal-builder-view.tsx
// Proposal Builder inbox: MVP specs generated upstream, grouped by business.
// Each can be turned into a complete, client-ready commercial proposal by
// Claude (executive summary, scope, deliverables, phases, terms, investment),
// integrating the pricing if it was generated in the Pricing Studio.

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import {
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Check,
  Copy,
  Clock,
  Lightbulb,
  Tag,
  ListChecks,
  Ban,
  Package,
  Map as MapIcon,
  Wallet,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Archive,
  RotateCcw,
  Trash2,
  X,
  ChevronsDownUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  generateProposalAction,
  archiveProposalAction,
  restoreProposalAction,
  deleteProposalAction,
  listProposalsAction,
} from "@/features/proposal-builder/actions";
import { proposalToMarkdown } from "@/features/proposal-builder/lib/markdown";
import type { Complexity } from "@/features/mvp-factory/types";
import type {
  ProposalBusiness,
  ProposalData,
  ProposalItem,
} from "@/features/proposal-builder/types";

const COMPLEXITY_LABEL: Record<Complexity, string> = { low: "Baja", medium: "Media", high: "Alta" };

interface Props {
  initialBusinesses: ProposalBusiness[];
}

export function ProposalBuilderView({ initialBusinesses }: Props) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedBusinesses, setArchivedBusinesses] = useState<ProposalBusiness[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, startDeleteSelected] = useTransition();

  const totalItems = businesses.reduce((n, b) => n + b.items.length, 0);
  const builtCount = businesses.reduce((n, b) => n + b.items.filter((i) => i.proposal).length, 0);

  function handleBuilt(mvpSpecId: string, proposal: ProposalData) {
    setBusinesses((prev) =>
      prev.map((b) => ({ ...b, items: b.items.map((i) => i.mvpSpecId === mvpSpecId ? { ...i, proposal } : i) }))
    );
  }

  function handleProposalArchived(mvpSpecId: string) {
    setBusinesses((prev) =>
      prev.map((b) => ({ ...b, items: b.items.map((i) => i.mvpSpecId === mvpSpecId ? { ...i, proposal: null } : i) }))
    );
  }

  function removeFromArchived(specId: string) {
    setArchivedBusinesses((prev) =>
      prev
        .map((biz) => ({ ...biz, items: biz.items.filter((i) => i.mvpSpecId !== specId) }))
        .filter((biz) => biz.items.length > 0)
    );
  }

  async function handleToggleArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const result = await listProposalsAction(true);
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
    const allArchived = archivedBusinesses.flatMap((b) => b.items);
    startDeleteSelected(async () => {
      for (const specId of selectedIds) {
        const item = allArchived.find((i) => i.mvpSpecId === specId);
        if (item?.proposal) await deleteProposalAction(item.proposal.id);
      }
      setArchivedBusinesses((prev) =>
        prev
          .map((biz) => ({ ...biz, items: biz.items.filter((i) => !selectedIds.has(i.mvpSpecId)) }))
          .filter((biz) => biz.items.length > 0)
      );
      setSelectedIds(new Set());
      setSelectMode(false);
    });
  }

  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-tight">Proposal Builder</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalItems > 0
              ? `${totalItems} MVP${totalItems === 1 ? "" : "s"} listo${totalItems === 1 ? "" : "s"} para propuesta · ${builtCount} con propuesta generada`
              : "Genera specs en el MVP Factory para poder crear propuestas."}
          </p>
        </div>
        {builtCount > 0 && (
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
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm max-w-sm">
            Aún no hay MVPs generados. Ve al{" "}
            <Link href="/mvp-factory" className="text-indigo-400 hover:text-indigo-300">MVP Factory</Link>{" "}
            y genera la spec de un MVP para poder crear su propuesta aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {businesses.map((b) => (
            <section key={b.placeId} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{b.businessName}</h2>
                <Link href="/pricing-studio" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  Ver pricing
                </Link>
              </div>
              <div className="space-y-3">
                {b.items.map((item) => (
                  <ProposalCard
                    key={item.mvpSpecId}
                    businessName={b.businessName}
                    item={item}
                    onBuilt={handleBuilt}
                    onArchived={handleProposalArchived}
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
            <p className="text-xs text-muted-foreground">No hay propuestas archivadas.</p>
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
              <div className="space-y-6">
                {archivedBusinesses.map((b) => (
                  <section key={b.placeId} className="space-y-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{b.businessName}</h2>
                    <div className="space-y-2">
                      {b.items.map((item) => (
                        <ArchivedProposalCard
                          key={item.mvpSpecId}
                          item={item}
                          selectMode={selectMode}
                          isSelected={selectedIds.has(item.mvpSpecId)}
                          onToggleSelect={toggleSelect}
                          onRestored={(specId) => {
                            removeFromArchived(specId);
                            listProposalsAction().then((r) => { if (r.ok) setBusinesses(r.data); });
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

// ─── MVP proposal card ────────────────────────────────────────────────────────

function ProposalCard({
  businessName,
  item,
  onBuilt,
  onArchived,
  collapseSignal,
}: {
  businessName: string;
  item: ProposalItem;
  onBuilt: (mvpSpecId: string, proposal: ProposalData) => void;
  onArchived?: (mvpSpecId: string) => void;
  collapseSignal: number;
}) {
  const storageKey = `nzt-proposal-card-${item.mvpSpecId}`;
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "true";
  });
  const [confirming, setConfirming] = useState(false);
  const [isGenerating, startGenerate] = useTransition();
  const [isArchiving, startArchive] = useTransition();

  useEffect(() => {
    if (collapseSignal > 0 && item.proposal) {
      setCollapsed(true);
      localStorage.setItem(storageKey, "true");
    }
  }, [collapseSignal, item.proposal, storageKey]);

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const result = await generateProposalAction(item.mvpSpecId);
      if (result.ok) { onBuilt(item.mvpSpecId, result.data); setCollapsed(false); localStorage.removeItem(storageKey); }
      else setError(result.error);
    });
  }

  function handleArchive() {
    if (!item.proposal) return;
    startArchive(async () => {
      const result = await archiveProposalAction(item.proposal!.id);
      if (result.ok) onArchived?.(item.mvpSpecId);
      setConfirming(false);
    });
  }

  return (
    <div className={cn("rounded-lg border flex overflow-hidden", item.proposal ? "border-indigo-500/70" : "border-border")}>
      {item.proposal && (
        <div className="flex flex-col items-center gap-1 border-r border-border bg-muted/5 px-1 py-2 shrink-0">
          <button type="button" onClick={() => setConfirming(true)} className="h-7 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground rounded hover:bg-accent transition-colors" title="Archivar propuesta">
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setCollapsed((v) => { localStorage.setItem(storageKey, String(!v)); return !v; })} className="h-7 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground rounded hover:bg-accent transition-colors" title={collapsed ? "Expandir" : "Colapsar"}>
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      <div className="flex-1 min-w-0 p-3.5 space-y-3">
        {confirming && (
          <div className="flex items-center gap-2 rounded bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5">
            <span className="text-[11px] text-rose-300/80 flex-1">¿Archivar esta propuesta?</span>
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
              {item.opportunityTitle}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 italic">"{item.pitch}"</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.hasPricing ? (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400"><Tag className="mr-1 h-3 w-3" />Con pricing</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin pricing</Badge>
            )}
          </div>
        </div>

        {item.proposal && collapsed && (
          <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80 truncate">{item.proposal.title}</p>
            <p className="mt-0.5 line-clamp-1 italic">{item.proposal.executiveSummary.slice(0, 100)}{item.proposal.executiveSummary.length > 100 ? "…" : ""}</p>
          </div>
        )}

        {!collapsed && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.timeline && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{item.timeline}</span>}
              {item.complexity && <span className="opacity-70">· Complejidad {COMPLEXITY_LABEL[item.complexity]}</span>}
            </div>
            {!item.hasPricing && !item.proposal && (
              <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-300/90 leading-relaxed">
                Aún no has generado el pricing. Puedes crear la propuesta igualmente (la inversión saldrá cualitativa) o generar primero el precio en el{" "}
                <Link href="/pricing-studio" className="underline hover:text-amber-200">Pricing Studio</Link>.
              </p>
            )}
            {!item.proposal ? (
              <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="w-full">
                {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redactando propuesta...</> : <><Sparkles className="h-4 w-4 mr-2" />Generar propuesta con IA</>}
              </Button>
            ) : (
              <ProposalDetail businessName={businessName} proposal={item.proposal} onRegenerate={handleGenerate} regenerating={isGenerating} />
            )}
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Archived proposal card ───────────────────────────────────────────────────

function ArchivedProposalCard({
  item,
  onRestored,
  onDeleted,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  item: ProposalItem;
  onRestored: (mvpSpecId: string) => void;
  onDeleted: (mvpSpecId: string) => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (mvpSpecId: string) => void;
}) {
  const [isRestoring, startRestore] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleRestore() {
    if (!item.proposal) return;
    startRestore(async () => {
      const result = await restoreProposalAction(item.proposal!.id);
      if (result.ok) onRestored(item.mvpSpecId);
    });
  }

  function handleDelete() {
    if (!item.proposal) return;
    startDelete(async () => {
      const result = await deleteProposalAction(item.proposal!.id);
      if (result.ok) onDeleted(item.mvpSpecId);
      setConfirmDelete(false);
    });
  }

  return (
    <div className="flex rounded-lg border border-dashed border-zinc-700 overflow-hidden">
      <div className="flex flex-col items-center justify-center border-r border-border/40 bg-muted/5 px-1 py-2 shrink-0 w-8">
        {selectMode ? (
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(item.mvpSpecId)} className="accent-indigo-500 cursor-pointer h-3.5 w-3.5" />
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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground/60 leading-snug inline-flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400/40 shrink-0" />
              {item.opportunityTitle}
            </p>
            {item.proposal && <p className="text-xs text-muted-foreground/70 italic mt-0.5 truncate">{item.proposal.title}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400/80">Archivado</Badge>
            {item.proposal && (
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

// ─── Proposal rendering ───────────────────────────────────────────────────────

function ProposalDetail({
  businessName,
  proposal,
  onRegenerate,
  regenerating,
}: {
  businessName: string;
  proposal: ProposalData;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    copyToClipboard(proposalToMarkdown(businessName, proposal), () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3.5">
      {proposal.title && (
        <p className="text-sm font-semibold text-foreground leading-snug">{proposal.title}</p>
      )}

      {proposal.executiveSummary && (
        <p className="text-xs text-foreground/90 leading-relaxed">{proposal.executiveSummary}</p>
      )}

      {proposal.problemStatement && (
        <Block label="El reto">{proposal.problemStatement}</Block>
      )}
      {proposal.proposedSolution && (
        <Block label="Solución propuesta">{proposal.proposedSolution}</Block>
      )}

      {proposal.scope.length > 0 && (
        <List label="Alcance del proyecto" icon={<ListChecks className="h-3.5 w-3.5" />} items={proposal.scope} accent />
      )}
      {proposal.outOfScope.length > 0 && (
        <List label="Fuera de alcance" icon={<Ban className="h-3.5 w-3.5" />} items={proposal.outOfScope} />
      )}
      {proposal.deliverables.length > 0 && (
        <List label="Entregables" icon={<Package className="h-3.5 w-3.5" />} items={proposal.deliverables} />
      )}

      {proposal.phases.length > 0 && (
        <div>
          <SectionLabel icon={<MapIcon className="h-3.5 w-3.5" />}>Plan de trabajo</SectionLabel>
          <ol className="space-y-2">
            {proposal.phases.map((p, i) => (
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

      {proposal.investment && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5">
          <SectionLabel icon={<Wallet className="h-3.5 w-3.5" />}>Inversión</SectionLabel>
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {proposal.investment}
          </p>
        </div>
      )}

      {proposal.terms.length > 0 && (
        <List label="Condiciones" items={proposal.terms} />
      )}
      {proposal.nextSteps.length > 0 && (
        <List label="Próximos pasos" icon={<ArrowRight className="h-3.5 w-3.5" />} items={proposal.nextSteps} accent />
      )}

      {proposal.callToAction && (
        <p className="rounded-md border border-border bg-background/40 px-2.5 py-2 text-xs font-medium text-foreground/90 leading-relaxed">
          {proposal.callToAction}
        </p>
      )}

      <Separator />

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
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────

function copyToClipboard(text: string, onDone: () => void) {
  navigator.clipboard
    .writeText(text)
    .then(onDone)
    .catch(() => {
      // Clipboard can be denied (e.g. no user gesture). Fail silently.
    });
}

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 inline-flex items-center gap-1.5">
      {icon}
      {children}
    </p>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className="text-xs text-foreground/85 leading-relaxed">{children}</p>
    </div>
  );
}

function List({
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
      <SectionLabel icon={icon}>{label}</SectionLabel>
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
