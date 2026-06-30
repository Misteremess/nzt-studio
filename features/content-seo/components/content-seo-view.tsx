"use client";

// features/content-seo/components/content-seo-view.tsx
// Content/SEO Agent: genera un plan de contenidos + copy de landing para un
// negocio analizado, y permite auditar el SEO completo de cualquier URL
// (o de la web de un negocio del CRM) con un informe profesional generado por IA.

import { useState, useTransition } from "react";
import {
  PenTool,
  Sparkles,
  Loader2,
  AlertTriangle,
  Inbox,
  Lightbulb,
  LayoutTemplate,
  Search,
  Tag,
  Globe,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertCircle,
  KeyRound,
  Zap,
  Target,
  ListChecks,
  Link2,
  FileText,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import {
  archiveSeoAuditAction,
  deleteSeoAuditAction,
  generateContentPlanAction,
  restoreSeoAuditAction,
  runSeoAuditAction,
} from "@/features/content-seo/actions";
import type {
  ContentPlanCandidate,
  ContentPlanData,
  SeoAuditCandidate,
  SeoAuditData,
  SeoCategoryReport,
  SeoFinding,
  SeoTechnicalData,
} from "@/features/content-seo/types";

interface Props {
  initialPlans: ContentPlanData[];
  candidates: ContentPlanCandidate[];
  initialPlaceId?: string;
  seoAuditCandidates: SeoAuditCandidate[];
  initialSeoAudits: SeoAuditData[];
}

type Tab = "content" | "seo";

export function ContentSeoView({ initialPlans, candidates, initialPlaceId, seoAuditCandidates, initialSeoAudits }: Props) {
  const [tab, setTab] = useState<Tab>("content");
  const [plans, setPlans] = useState<ContentPlanData[]>(initialPlans);
  const initialSelected =
    initialPlans.find((p) => p.placeId === initialPlaceId)?.placeId ?? initialPlans[0]?.placeId ?? null;
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialSelected);
  const [error, setError] = useState("");

  const selected = plans.find((p) => p.placeId === selectedPlaceId) ?? null;

  function onSaved(plan: ContentPlanData) {
    setPlans((prev) => {
      const exists = prev.some((p) => p.placeId === plan.placeId);
      return exists ? prev.map((p) => (p.placeId === plan.placeId ? plan : p)) : [plan, ...prev];
    });
    setSelectedPlaceId(plan.placeId);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <PenTool className="h-4 w-4" />
          Content/SEO Agent
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Genera un plan de contenidos y copy de landing para un negocio analizado, o lanza una auditoría SEO
          profesional completa de cualquier URL.
        </p>
      </div>

      <AiProviderNotice moduleId="content-seo" />

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-muted/30 p-1">
        <TabButton active={tab === "content"} onClick={() => setTab("content")} icon={<Lightbulb className="h-3.5 w-3.5" />}>
          Plan de contenidos
        </TabButton>
        <TabButton active={tab === "seo"} onClick={() => setTab("seo")} icon={<Gauge className="h-3.5 w-3.5" />}>
          Auditoría SEO
        </TabButton>
      </div>

      {tab === "content" ? (
        <ContentPlanTab
          plans={plans}
          candidates={candidates}
          initialPlaceId={initialPlaceId}
          selected={selected}
          selectedPlaceId={selectedPlaceId}
          onSelect={setSelectedPlaceId}
          onSaved={onSaved}
          onError={setError}
        />
      ) : (
        <SeoAuditTab candidates={seoAuditCandidates} initialAudits={initialSeoAudits} onError={setError} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Content plan tab ───────────────────────────────────────────────────────

function ContentPlanTab({
  plans,
  candidates,
  initialPlaceId,
  selected,
  selectedPlaceId,
  onSelect,
  onSaved,
  onError,
}: {
  plans: ContentPlanData[];
  candidates: ContentPlanCandidate[];
  initialPlaceId?: string;
  selected: ContentPlanData | null;
  selectedPlaceId: string | null;
  onSelect: (placeId: string) => void;
  onSaved: (plan: ContentPlanData) => void;
  onError: (msg: string) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="flex flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
        <GenerateForm candidates={candidates} initialPlaceId={initialPlaceId} onSaved={onSaved} onError={onError} />

        {plans.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planes generados ({plans.length})
            </h2>
            <div className="space-y-1.5">
              {plans.map((p) => (
                <PlanListItem key={p.placeId} plan={p} selected={p.placeId === selectedPlaceId} onSelect={() => onSelect(p.placeId)} />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="overflow-y-auto xl:col-span-8">
        {selected ? (
          <PlanPreview plan={selected} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-30" />
            <p className="text-sm">Genera un plan para verlo aquí.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generate form ──────────────────────────────────────────────────────────

function GenerateForm({
  candidates,
  initialPlaceId,
  onSaved,
  onError,
}: {
  candidates: ContentPlanCandidate[];
  initialPlaceId?: string;
  onSaved: (plan: ContentPlanData) => void;
  onError: (msg: string) => void;
}) {
  const [placeId, setPlaceId] = useState(
    candidates.find((c) => c.placeId === initialPlaceId)?.placeId ?? candidates[0]?.placeId ?? ""
  );
  const [pending, startTransition] = useTransition();

  const candidate = candidates.find((c) => c.placeId === placeId) ?? null;

  function generate() {
    if (!candidate) {
      onError("Selecciona un negocio.");
      return;
    }
    onError("");
    startTransition(async () => {
      const result = await generateContentPlanAction(candidate);
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
          Generar plan de contenidos
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
                  {c.hasPlan ? " (plan existente)" : ""}
                </option>
              ))}
            </select>
            {candidate && candidate.seoIssues.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {candidate.seoIssues.length} problema(s) detectados en la auditoría web.
              </p>
            )}
          </div>
        )}

        <button
          onClick={generate}
          disabled={pending || candidates.length === 0}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {candidate?.hasPlan ? "Regenerar plan" : "Generar plan"}
        </button>
      </CardContent>
    </Card>
  );
}

// ─── List items ─────────────────────────────────────────────────────────────

function PlanListItem({ plan, selected, onSelect }: { plan: ContentPlanData; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
      }`}
    >
      <p className="truncate text-xs font-medium text-foreground">{plan.businessName}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {plan.topics.length} ideas · {formatDate(plan.updatedAt)}
      </p>
    </button>
  );
}

// ─── Preview ────────────────────────────────────────────────────────────────

function PlanPreview({ plan }: { plan: ContentPlanData }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{plan.businessName}</h2>
        <p className="text-[11px] text-muted-foreground">
          Modelo: {plan.model} · {formatDate(plan.updatedAt)}
        </p>
      </div>

      <Card className="overflow-hidden border-primary/30">
        <CardContent className="space-y-3 p-6 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Vista previa de landing
          </span>
          <p className="text-lg font-semibold text-foreground sm:text-xl">{plan.landingCopy.headline}</p>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">{plan.landingCopy.subheadline}</p>
          {plan.landingCopy.bullets.length > 0 && (
            <ul className="mx-auto flex max-w-2xl flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {plan.landingCopy.bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          {plan.landingCopy.ctaLabel && (
            <span className="mt-2 inline-block rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
              {plan.landingCopy.ctaLabel}
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="space-y-3 p-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Plan de contenidos
            </span>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {plan.topics.map((topic, i) => (
                <div key={i} className="rounded-md border border-border/60 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-xs font-medium text-foreground">{topic.title}</p>
                    {topic.format && (
                      <Badge variant="outline" className="max-w-[45%] shrink-0 whitespace-normal text-right text-[10px]">
                        {topic.format}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{topic.angle}</p>
                  {topic.keywords.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {topic.keywords.map((kw, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {plan.seoNotes.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Search className="h-3.5 w-3.5" />
                Notas SEO
              </span>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                {plan.seoNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── SEO Audit tab ──────────────────────────────────────────────────────────

function SeoAuditTab({
  candidates,
  initialAudits,
  onError,
}: {
  candidates: SeoAuditCandidate[];
  initialAudits: SeoAuditData[];
  onError: (msg: string) => void;
}) {
  const [audits, setAudits] = useState<SeoAuditData[]>(initialAudits);
  const [selectedId, setSelectedId] = useState<string | null>(initialAudits[0]?.id ?? null);
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<SeoAuditData[] | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = audits.find((a) => a.id === selectedId) ?? null;

  function onSaved(audit: SeoAuditData) {
    setAudits((prev) => [audit, ...prev]);
    setSelectedId(audit.id);
  }

  function archive(id: string) {
    onError("");
    startTransition(async () => {
      const result = await archiveSeoAuditAction(id);
      if (result.ok) {
        setAudits((prev) => prev.filter((a) => a.id !== id));
        if (selectedId === id) setSelectedId(null);
      } else {
        onError(result.error);
      }
    });
  }

  function toggleArchived() {
    if (showArchived) {
      setShowArchived(false);
      return;
    }
    onError("");
    startTransition(async () => {
      const { listSeoAuditsAction } = await import("@/features/content-seo/actions");
      const result = await listSeoAuditsAction(true);
      if (result.ok) {
        setArchived(result.data);
        setShowArchived(true);
      } else {
        onError(result.error);
      }
    });
  }

  function restore(id: string) {
    onError("");
    startTransition(async () => {
      const result = await restoreSeoAuditAction(id);
      if (result.ok) {
        setArchived((prev) => prev?.filter((a) => a.id !== id) ?? null);
      } else {
        onError(result.error);
      }
    });
  }

  function remove(id: string) {
    onError("");
    startTransition(async () => {
      const result = await deleteSeoAuditAction(id);
      if (result.ok) {
        setArchived((prev) => prev?.filter((a) => a.id !== id) ?? null);
      } else {
        onError(result.error);
      }
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="flex flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
        <SeoAuditForm candidates={candidates} onSaved={onSaved} onError={onError} />

        {audits.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Auditorías generadas ({audits.length})
            </h2>
            <div className="space-y-1.5">
              {audits.map((a) => (
                <SeoAuditListItem
                  key={a.id}
                  audit={a}
                  selected={a.id === selectedId}
                  onSelect={() => setSelectedId(a.id)}
                  onArchive={() => archive(a.id)}
                  pending={pending}
                />
              ))}
            </div>
          </section>
        )}

        <button
          onClick={toggleArchived}
          disabled={pending}
          className="inline-flex w-fit items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Archive className="h-3 w-3" />
          {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
        </button>

        {showArchived && archived && (
          <section className="space-y-1.5">
            {archived.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No hay auditorías archivadas.</p>
            ) : (
              archived.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{a.businessName ?? a.url}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => restore(a.id)} disabled={pending} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Restaurar">
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(a.id)} disabled={pending} className="rounded p-1 text-muted-foreground hover:text-rose-400" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </div>

      <div className="overflow-y-auto xl:col-span-8">
        {selected ? (
          <SeoAuditPreview audit={selected} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Globe className="h-8 w-8 opacity-30" />
            <p className="text-sm">Indica una URL para generar una auditoría SEO completa.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SeoAuditListItem({
  audit,
  selected,
  onSelect,
  onArchive,
  pending,
}: {
  audit: SeoAuditData;
  selected: boolean;
  onSelect: () => void;
  onArchive: () => void;
  pending: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
      }`}
    >
      <button onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className="truncate text-xs font-medium text-foreground">{audit.businessName || audit.url}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {audit.url} · {formatDate(audit.updatedAt)}
        </p>
      </button>
      <ScoreBadge score={audit.report.overallScore || audit.score} compact />
      <button onClick={onArchive} disabled={pending} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground" title="Archivar">
        <Archive className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── SEO Audit form ─────────────────────────────────────────────────────────

function SeoAuditForm({
  candidates,
  onSaved,
  onError,
}: {
  candidates: SeoAuditCandidate[];
  onSaved: (audit: SeoAuditData) => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"url" | "candidate">("url");
  const [url, setUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [placeId, setPlaceId] = useState(candidates[0]?.placeId ?? "");
  const [pending, startTransition] = useTransition();

  const candidate = candidates.find((c) => c.placeId === placeId) ?? null;

  function run() {
    onError("");
    const targetUrl = mode === "candidate" ? candidate?.websiteUri ?? "" : url.trim();
    const targetName = mode === "candidate" ? candidate?.businessName ?? null : businessName.trim() || null;

    if (!targetUrl) {
      onError(mode === "candidate" ? "Selecciona un negocio con web." : "Indica una URL a analizar.");
      return;
    }

    startTransition(async () => {
      const result = await runSeoAuditAction({ url: targetUrl, businessName: targetName });
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
          <Gauge className="h-3.5 w-3.5" />
          Auditoría SEO completa
        </span>
        <p className="text-[11px] text-muted-foreground">
          Analiza cualquier URL: técnico, on-page, contenido y visibilidad, con recomendaciones priorizadas.
        </p>

        <div className="inline-flex w-full gap-1 rounded-md border border-border bg-muted/30 p-1">
          <button
            onClick={() => setMode("url")}
            className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              mode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            URL libre
          </button>
          <button
            onClick={() => setMode("candidate")}
            disabled={candidates.length === 0}
            className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
              mode === "candidate" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Negocio del CRM
          </button>
        </div>

        {mode === "url" ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">URL a analizar</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ejemplo.com"
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Nombre del negocio (opcional)</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Para contextualizar el informe"
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no hay negocios con web guardada en el Rastreador.</p>
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
                </option>
              ))}
            </select>
            {candidate && <p className="truncate text-[11px] text-muted-foreground">{candidate.websiteUri}</p>}
          </div>
        )}

        <button
          onClick={run}
          disabled={pending}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {pending ? "Analizando…" : "Analizar SEO completo"}
        </button>
      </CardContent>
    </Card>
  );
}

// ─── SEO Audit preview ──────────────────────────────────────────────────────

function SeoAuditPreview({ audit }: { audit: SeoAuditData }) {
  const { report, technical } = audit;
  const overallScore = report.overallScore || technical.score;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{audit.businessName || audit.url}</h2>
          <a
            href={audit.finalUrl ?? audit.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 truncate text-[11px] text-primary hover:underline"
          >
            <Link2 className="h-3 w-3 shrink-0" />
            {audit.finalUrl ?? audit.url}
          </a>
        </div>
        <p className="shrink-0 text-[11px] text-muted-foreground">
          {audit.model} · {formatDate(audit.updatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* Executive summary + score */}
        <Card className="xl:col-span-2">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-1 sm:w-28">
              <ScoreBadge score={overallScore} large />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Score global</span>
              <span className="text-[10px] text-muted-foreground">Técnico: {technical.score}/100</span>
            </div>
            <div className="flex-1 space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <FileText className="h-3.5 w-3.5" />
                Resumen ejecutivo
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">{report.executiveSummary}</p>
            </div>
          </CardContent>
        </Card>

        {/* Category cards — bento grid */}
        {report.categories.map((cat, i) => (
          <CategoryCard key={i} category={cat} />
        ))}

        {/* Quick wins */}
        {report.quickWins.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Quick wins
              </span>
              <ul className="space-y-1.5">
                {report.quickWins.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {w}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Long term actions */}
        {report.longTermActions.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Target className="h-3.5 w-3.5 text-sky-400" />
                Plan a medio/largo plazo
              </span>
              <ul className="space-y-1.5">
                {report.longTermActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    {a}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Keyword opportunities */}
        {report.keywordOpportunities.length > 0 && (
          <Card className="xl:col-span-2">
            <CardContent className="space-y-2 p-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                Oportunidades de palabras clave
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {report.keywordOpportunities.map((k, i) => (
                  <div key={i} className="rounded-md border border-border/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{k.keyword}</p>
                      {k.intent && (
                        <Badge variant="outline" className="max-w-[45%] shrink-0 whitespace-normal text-right text-[10px]">
                          {k.intent}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{k.suggestion}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Technical details */}
        <Card className="xl:col-span-2">
          <CardContent className="space-y-3 p-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              Datos técnicos
            </span>
            <TechnicalGrid technical={technical} />
            {technical.issues.length > 0 && (
              <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                {technical.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <SeverityDot severity={issue.severity} />
                    <div>
                      <span className="font-medium text-foreground">{issue.label}</span>
                      <span className="text-muted-foreground"> — {issue.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: SeoCategoryReport }) {
  return (
    <Card>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{category.name}</span>
          <ScoreBadge score={category.score} compact />
        </div>
        <div className="space-y-2">
          {category.findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FindingRow({ finding }: { finding: SeoFinding }) {
  return (
    <div className="rounded-md border border-border/60 p-2">
      <div className="flex items-start gap-1.5">
        <StatusIcon status={finding.status} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{finding.title}</p>
          {finding.description && <p className="mt-0.5 text-[11px] text-muted-foreground">{finding.description}</p>}
          {finding.recommendation && (
            <p className="mt-1 text-[11px] text-primary/90">→ {finding.recommendation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SeoFinding["status"] }) {
  if (status === "ok") return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (status === "critical") return <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />;
  return <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />;
}

function SeverityDot({ severity }: { severity: "low" | "medium" | "high" }) {
  const cls = severity === "high" ? "bg-rose-400" : severity === "medium" ? "bg-amber-400" : "bg-muted-foreground";
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function ScoreBadge({ score, compact, large }: { score: number; compact?: boolean; large?: boolean }) {
  const color = score >= 80 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : score >= 50 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-rose-400 border-rose-500/30 bg-rose-500/10";
  if (large) {
    return (
      <span className={`inline-flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-semibold ${color}`}>
        {score}
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color} ${compact ? "" : ""}`}>
      {score}
    </span>
  );
}

function TechnicalGrid({ technical: t }: { technical: SeoTechnicalData }) {
  const items: { label: string; value: string }[] = [
    { label: "HTTPS", value: t.usesHttps ? "Sí" : "No" },
    { label: "Adaptada a móvil", value: t.hasViewport ? "Sí" : "No" },
    { label: "Tiempo de respuesta", value: t.responseTimeMs !== null ? `${t.responseTimeMs} ms` : "—" },
    { label: "Tamaño de página", value: t.pageSizeBytes !== null ? `${Math.round(t.pageSizeBytes / 1024)} KB` : "—" },
    { label: "Title", value: t.title ? `${t.titleLength} car.` : "Ausente" },
    { label: "Meta description", value: t.metaDescription ? `${t.metaDescriptionLength} car.` : "Ausente" },
    { label: "H1 / H2", value: `${t.h1Count} / ${t.h2Count}` },
    { label: "Canonical", value: t.canonicalUrl ? "Sí" : "No" },
    { label: "Datos estructurados", value: t.hasStructuredData ? t.structuredDataTypes.join(", ") || "Sí" : "No" },
    { label: "Open Graph / Twitter", value: `${t.hasOgTags ? "Sí" : "No"} / ${t.hasTwitterCard ? "Sí" : "No"}` },
    { label: "Imágenes (sin alt)", value: `${t.imageCount} (${t.imagesMissingAlt})` },
    { label: "Enlaces internos / externos", value: `${t.internalLinkCount} / ${t.externalLinkCount}` },
    { label: "Palabras (aprox.)", value: `${t.wordCount}` },
    { label: "Analítica", value: t.hasAnalytics ? "Sí" : "No" },
    { label: "robots.txt / sitemap.xml", value: `${t.hasRobotsTxt ? "Sí" : "No"} / ${t.hasSitemap ? "Sí" : "No"}` },
    { label: "Idioma", value: t.lang ?? "—" },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="truncate font-medium text-foreground">{item.value}</span>
        </div>
      ))}
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
