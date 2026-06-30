"use client";

// features/pricing-studio/components/pricing-studio-view.tsx
// Pricing Studio inbox: MVP specs generated in the MVP Factory, grouped by
// business. Each can be turned into a concrete, sellable price by Claude
// (build cost + monthly maintenance + tiers), then read inline or copied as
// Markdown.

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import {
  Tag,
  Loader2,
  RefreshCw,
  Sparkles,
  Check,
  Copy,
  Clock,
  Star,
  Wallet,
  Lightbulb,
  ListChecks,
  Repeat,
  CalendarClock,
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
  generatePricingAction,
  archivePricingAction,
  restorePricingAction,
  deletePricingAction,
  listPricingAction,
} from "@/features/pricing-studio/actions";
import { pricingToMarkdown } from "@/features/pricing-studio/lib/markdown";
import type { Complexity } from "@/features/mvp-factory/types";
import type {
  PricingBusiness,
  PricingData,
  PricingItem,
  SaasModel,
} from "@/features/pricing-studio/types";

const COMPLEXITY_LABEL: Record<Complexity, string> = { low: "Baja", medium: "Media", high: "Alta" };

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === "EUR" ? "€" : ` ${currency}`;
  return currency === "EUR" ? `${amount.toLocaleString("es-ES")} ${symbol}` : `${amount.toLocaleString("es-ES")}${symbol}`;
}

interface Props {
  initialBusinesses: PricingBusiness[];
}

export function PricingStudioView({ initialBusinesses }: Props) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedBusinesses, setArchivedBusinesses] = useState<PricingBusiness[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, startDeleteSelected] = useTransition();

  const totalItems = businesses.reduce((n, b) => n + b.items.length, 0);
  const pricedCount = businesses.reduce((n, b) => n + b.items.filter((i) => i.pricing).length, 0);

  function handlePriced(mvpSpecId: string, pricing: PricingData) {
    setBusinesses((prev) =>
      prev.map((b) => ({ ...b, items: b.items.map((i) => i.mvpSpecId === mvpSpecId ? { ...i, pricing } : i) }))
    );
  }

  function handlePricingArchived(mvpSpecId: string) {
    setBusinesses((prev) =>
      prev.map((b) => ({ ...b, items: b.items.map((i) => i.mvpSpecId === mvpSpecId ? { ...i, pricing: null } : i) }))
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
      const result = await listPricingAction(true);
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
        if (item?.pricing) await deletePricingAction(item.pricing.id);
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
      <AiProviderNotice moduleId="pricing-studio" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-tight">Pricing Studio</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalItems > 0
              ? `${totalItems} MVP${totalItems === 1 ? "" : "s"} listo${totalItems === 1 ? "" : "s"} para precio · ${pricedCount} con pricing generado`
              : "Genera specs en el MVP Factory para poder ponerles precio."}
          </p>
        </div>
        {pricedCount > 0 && (
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
          <Tag className="h-10 w-10 opacity-30" />
          <p className="text-sm max-w-sm">
            Aún no hay MVPs generados. Ve al{" "}
            <Link href="/mvp-factory" className="text-indigo-400 hover:text-indigo-300">MVP Factory</Link>{" "}
            y genera la spec de un MVP para poder ponerle precio aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {businesses.map((b) => (
            <section key={b.placeId} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{b.businessName}</h2>
                <Link href="/mvp-factory" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  Ver MVPs
                </Link>
              </div>
              <div className="space-y-3">
                {b.items.map((item) => (
                  <PricingCard
                    key={item.mvpSpecId}
                    businessName={b.businessName}
                    item={item}
                    onPriced={handlePriced}
                    onArchived={handlePricingArchived}
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
            <p className="text-xs text-muted-foreground">No hay pricings archivados.</p>
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
                        <ArchivedPricingCard
                          key={item.mvpSpecId}
                          item={item}
                          selectMode={selectMode}
                          isSelected={selectedIds.has(item.mvpSpecId)}
                          onToggleSelect={toggleSelect}
                          onRestored={(specId) => {
                            removeFromArchived(specId);
                            listPricingAction().then((r) => { if (r.ok) setBusinesses(r.data); });
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

// ─── MVP pricing card ─────────────────────────────────────────────────────────

function PricingCard({
  businessName,
  item,
  onPriced,
  onArchived,
  collapseSignal,
}: {
  businessName: string;
  item: PricingItem;
  onPriced: (mvpSpecId: string, pricing: PricingData) => void;
  onArchived?: (mvpSpecId: string) => void;
  collapseSignal: number;
}) {
  const storageKey = `nzt-pricing-card-${item.mvpSpecId}`;
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
    if (collapseSignal > 0 && item.pricing) setCollapsed(true);
  }

  // Persiste el colapso cuando cambia (la escritura en localStorage es un
  // efecto externo, no puede ir en el bloque de render de arriba).
  useEffect(() => {
    if (collapsed) localStorage.setItem(storageKey, "true");
  }, [collapsed, storageKey]);

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const result = await generatePricingAction(item.mvpSpecId);
      if (result.ok) { onPriced(item.mvpSpecId, result.data); setCollapsed(false); localStorage.removeItem(storageKey); }
      else setError(result.error);
    });
  }

  function handleArchive() {
    if (!item.pricing) return;
    startArchive(async () => {
      const result = await archivePricingAction(item.pricing!.id);
      if (result.ok) onArchived?.(item.mvpSpecId);
      setConfirming(false);
    });
  }

  return (
    <div className={cn("rounded-lg border flex overflow-hidden", item.pricing ? "border-indigo-500/70" : "border-border")}>
      {item.pricing && (
        <div className="flex flex-col items-center gap-1 border-r border-border bg-muted/5 px-1 py-2 shrink-0">
          <button type="button" onClick={() => setConfirming(true)} className="h-7 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground rounded hover:bg-accent transition-colors" title="Archivar pricing">
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
            <span className="text-[11px] text-rose-300/80 flex-1">¿Archivar este pricing?</span>
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
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 italic">&ldquo;{item.pitch}&rdquo;</p>
          </div>
        </div>

        {item.pricing && collapsed && (
          <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{formatMoney(item.pricing.setupPrice, item.pricing.currency)}</span>
            {" "}<span className="opacity-60">construcción</span>
            {item.pricing.monthlyPrice != null && (
              <> · <span className="text-foreground font-medium">{formatMoney(item.pricing.monthlyPrice, item.pricing.currency)}/mes</span></>
            )}
          </div>
        )}

        {!collapsed && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.timeline && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{item.timeline}</span>}
              {item.complexity && <span className="opacity-70">· Complejidad {COMPLEXITY_LABEL[item.complexity]}</span>}
            </div>
            {!item.pricing ? (
              <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="w-full">
                {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculando precio...</> : <><Sparkles className="h-4 w-4 mr-2" />Generar pricing con IA</>}
              </Button>
            ) : (
              <PricingDetail businessName={businessName} item={item} pricing={item.pricing} onRegenerate={handleGenerate} regenerating={isGenerating} />
            )}
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Archived pricing card ────────────────────────────────────────────────────

function ArchivedPricingCard({
  item,
  onRestored,
  onDeleted,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  item: PricingItem;
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
    if (!item.pricing) return;
    startRestore(async () => {
      const result = await restorePricingAction(item.pricing!.id);
      if (result.ok) onRestored(item.mvpSpecId);
    });
  }

  function handleDelete() {
    if (!item.pricing) return;
    startDelete(async () => {
      const result = await deletePricingAction(item.pricing!.id);
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
            {item.pricing && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {formatMoney(item.pricing.setupPrice, item.pricing.currency)} construcción
                {item.pricing.monthlyPrice != null && ` · ${formatMoney(item.pricing.monthlyPrice, item.pricing.currency)}/mes`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400/80">Archivado</Badge>
            {item.pricing && (
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

// ─── Pricing rendering ────────────────────────────────────────────────────────

function PricingDetail({
  businessName,
  item,
  pricing,
  onRegenerate,
  regenerating,
}: {
  businessName: string;
  item: PricingItem;
  pricing: PricingData;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    copyToClipboard(
      pricingToMarkdown(businessName, item.opportunityTitle, pricing),
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    );
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3.5">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5">
          <p className="text-[11px] uppercase tracking-wider text-indigo-300">Construcción</p>
          <p className="text-base font-semibold text-foreground">
            {formatMoney(pricing.setupPrice, pricing.currency)}
          </p>
          <p className="text-[11px] text-muted-foreground">pago único</p>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Mantenimiento</p>
          <p className="text-base font-semibold text-foreground">
            {pricing.monthlyPrice != null
              ? formatMoney(pricing.monthlyPrice, pricing.currency)
              : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {pricing.monthlyPrice != null ? "al mes" : "no aplica"}
          </p>
        </div>
      </div>

      {/* SaaS / subscription perspective */}
      {pricing.saasModel && (
        <SaasPerspective saas={pricing.saasModel} currency={pricing.currency} />
      )}

      {/* Tiers */}
      {pricing.tiers.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel icon={<Star className="h-3.5 w-3.5" />}>Planes</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {pricing.tiers.map((t, i) => {
              const recommended = pricing.recommendedTier === t.name;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col rounded-md border p-2.5",
                    recommended
                      ? "border-indigo-500 bg-indigo-500/5"
                      : "border-border bg-background/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-xs font-semibold text-foreground">{t.name}</p>
                    {recommended && (
                      <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                        Recomendado
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatMoney(t.price, pricing.currency)}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {t.billing === "monthly" ? "/mes" : " único"}
                    </span>
                  </p>
                  {t.description && (
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      {t.description}
                    </p>
                  )}
                  {t.features.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {t.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-[11px] text-foreground/85 leading-relaxed">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pricing.paymentTerms && (
        <div>
          <SectionLabel icon={<Wallet className="h-3.5 w-3.5" />}>Condiciones de pago</SectionLabel>
          <p className="text-xs text-foreground/85 leading-relaxed">{pricing.paymentTerms}</p>
        </div>
      )}

      {pricing.rationale && (
        <div>
          <SectionLabel>Por qué este precio</SectionLabel>
          <p className="text-xs text-foreground/85 leading-relaxed">{pricing.rationale}</p>
        </div>
      )}

      {pricing.assumptions.length > 0 && (
        <div>
          <SectionLabel icon={<ListChecks className="h-3.5 w-3.5" />}>Supuestos</SectionLabel>
          <ul className="space-y-1">
            {pricing.assumptions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/85 leading-relaxed">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
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

// ─── SaaS / subscription perspective ──────────────────────────────────────────

function SaasPerspective({ saas, currency }: { saas: SaasModel; currency: string }) {
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-300 inline-flex items-center gap-1.5">
        <Repeat className="h-3.5 w-3.5" />
        Modelo suscripción (SaaS)
      </p>

      <div className="flex items-end gap-1.5">
        <span className="text-xl font-semibold text-foreground">
          {formatMoney(saas.monthlyPrice, currency)}
        </span>
        <span className="text-xs text-muted-foreground mb-1">/mes</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {saas.annualPrice != null && (
          <SaasChip>{formatMoney(saas.annualPrice, currency)}/año</SaasChip>
        )}
        {saas.setupFee != null && (
          <SaasChip>Alta {formatMoney(saas.setupFee, currency)}</SaasChip>
        )}
        {saas.minimumTermMonths != null && (
          <SaasChip>Permanencia {saas.minimumTermMonths} meses</SaasChip>
        )}
        {saas.breakEvenMonths != null && (
          <SaasChip icon={<CalendarClock className="h-3 w-3" />}>
            Iguala el pago único en {saas.breakEvenMonths} meses
          </SaasChip>
        )}
      </div>

      {saas.includedServices.length > 0 && (
        <ul className="space-y-1">
          {saas.includedServices.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-[11px] text-foreground/85 leading-relaxed"
            >
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {saas.rationale && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{saas.rationale}</p>
      )}
    </div>
  );
}

function SaasChip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
      {icon}
      {children}
    </span>
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
