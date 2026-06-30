"use client";

// features/delivery-workspace/components/delivery-workspace-view.tsx
// Post-sale tracking board. Specs shipped from the MVP Factory show up as
// "available to start"; once started they become deliveries with a status
// lifecycle, a checklist, repo/deploy links and free-text notes. No AI.

import { useState, useTransition } from "react";
import {
  Truck,
  Rocket,
  Loader2,
  Check,
  Plus,
  Trash2,
  GitBranch,
  ExternalLink,
  AlertTriangle,
  Calculator,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  addDeliveryTaskAction,
  deleteDeliveryAction,
  deleteDeliveryTaskAction,
  setDeliveryStatusAction,
  setDeliveryTaskDoneAction,
  startDeliveryAction,
  updateDeliveryMetaAction,
} from "@/features/delivery-workspace/actions";
import type {
  AvailableSpec,
  DeliveryBoard,
  DeliveryItem,
  DeliveryStatus,
} from "@/features/delivery-workspace/types";

interface Props {
  initialData: DeliveryBoard;
}

const STATUS_META: Record<DeliveryStatus, { label: string; cls: string }> = {
  QUEUED: { label: "En cola", cls: "border-border text-muted-foreground" },
  IN_PROGRESS: { label: "En desarrollo", cls: "border-indigo-500/40 text-indigo-300" },
  IN_REVIEW: { label: "En revisión", cls: "border-amber-500/40 text-amber-300" },
  DELIVERED: { label: "Entregado", cls: "border-emerald-500/40 text-emerald-300" },
  ON_HOLD: { label: "En pausa", cls: "border-zinc-500/40 text-zinc-300" },
  CANCELLED: { label: "Cancelado", cls: "border-rose-500/40 text-rose-300" },
};

const STATUS_ORDER: DeliveryStatus[] = [
  "QUEUED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DELIVERED",
  "ON_HOLD",
  "CANCELLED",
];

export function DeliveryWorkspaceView({ initialData }: Props) {
  const [board, setBoard] = useState<DeliveryBoard>(initialData);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const stats = board.stats;
  const empty = board.deliveries.length === 0 && board.available.length === 0;

  function apply(result: { ok: boolean; data?: DeliveryBoard; error?: string }) {
    if (result.ok && result.data) setBoard(result.data);
    else if (!result.ok) setError(result.error ?? "Algo salió mal.");
  }

  function start(mvpSpecId: string) {
    setError("");
    startTransition(async () => {
      apply(await startDeliveryAction(mvpSpecId));
    });
  }

  // Local mutators for delivery-level state (optimistic where cheap).
  function patchDelivery(id: string, patch: Partial<DeliveryItem>) {
    setBoard((b) => ({
      ...b,
      deliveries: b.deliveries.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <Truck className="h-4 w-4" />
          Delivery Workspace
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Seguimiento post-venta de los MVPs que decides construir. Estado, checklist, repo y
          despliegue — todo en un solo sitio.
        </p>
      </div>

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      {empty ? (
        <EmptyState />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard label="Por iniciar" value={stats.available} />
            <StatCard label="En desarrollo" value={stats.active} accent="indigo" />
            <StatCard label="En revisión" value={stats.inReview} accent="amber" />
            <StatCard label="Entregados" value={stats.delivered} accent="emerald" />
          </div>

          {/* Available to start */}
          {board.available.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Listos para iniciar ({board.available.length})
              </h2>
              <div className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {board.available.map((s) => (
                  <AvailableCard key={s.mvpSpecId} spec={s} pending={pending} onStart={start} />
                ))}
              </div>
            </section>
          )}

          {/* Active deliveries */}
          {board.deliveries.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entregas ({board.deliveries.length})
              </h2>
              <div className="grid items-start gap-3 xl:grid-cols-2">
                {board.deliveries.map((d) => (
                  <DeliveryCard
                    key={d.id}
                    delivery={d}
                    onPatch={patchDelivery}
                    onBoard={setBoard}
                    onError={setError}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Available spec card ──────────────────────────────────────────────────────

function AvailableCard({
  spec,
  pending,
  onStart,
}: {
  spec: AvailableSpec;
  pending: boolean;
  onStart: (mvpSpecId: string) => void;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-start justify-between gap-3 p-3.5">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-[11px] text-muted-foreground">{spec.businessName}</p>
          <p className="text-sm font-medium text-foreground">{spec.opportunityTitle}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{spec.pitch}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {spec.complexity && <ComplexityBadge complexity={spec.complexity} />}
            {spec.hasPricing && (
              <MiniBadge icon={<Calculator className="h-3 w-3" />} label="Pricing" />
            )}
            {spec.hasProposal && (
              <MiniBadge icon={<FileText className="h-3 w-3" />} label="Propuesta" />
            )}
          </div>
        </div>
        <button
          onClick={() => onStart(spec.mvpSpecId)}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-indigo-500 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
          Iniciar entrega
        </button>
      </CardContent>
    </Card>
  );
}

// ─── Delivery card ────────────────────────────────────────────────────────────

function DeliveryCard({
  delivery,
  onPatch,
  onBoard,
  onError,
}: {
  delivery: DeliveryItem;
  onPatch: (id: string, patch: Partial<DeliveryItem>) => void;
  onBoard: (b: DeliveryBoard) => void;
  onError: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [repoUrl, setRepoUrl] = useState(delivery.repoUrl ?? "");
  const [deployUrl, setDeployUrl] = useState(delivery.deployUrl ?? "");
  const [notes, setNotes] = useState(delivery.notes ?? "");

  const meta = STATUS_META[delivery.status];
  const done = delivery.tasks.filter((t) => t.done).length;
  const total = delivery.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function changeStatus(status: DeliveryStatus) {
    const prev = delivery.status;
    onPatch(delivery.id, { status });
    startTransition(async () => {
      const r = await setDeliveryStatusAction(delivery.id, status);
      if (!r.ok) {
        onPatch(delivery.id, { status: prev });
        onError(r.error);
      }
    });
  }

  function saveMeta(patch: { repoUrl?: string; deployUrl?: string; notes?: string }) {
    startTransition(async () => {
      const r = await updateDeliveryMetaAction(delivery.id, patch);
      if (!r.ok) onError(r.error);
      else onPatch(delivery.id, patch);
    });
  }

  function addTask() {
    const t = newTask.trim();
    if (!t) return;
    setNewTask("");
    startTransition(async () => {
      const r = await addDeliveryTaskAction(delivery.id, t);
      if (r.ok) onBoard(r.data);
      else onError(r.error);
    });
  }

  function toggleTask(taskId: string, next: boolean) {
    onPatch(delivery.id, {
      tasks: delivery.tasks.map((t) => (t.id === taskId ? { ...t, done: next } : t)),
    });
    startTransition(async () => {
      const r = await setDeliveryTaskDoneAction(taskId, next);
      if (!r.ok) {
        onPatch(delivery.id, {
          tasks: delivery.tasks.map((t) => (t.id === taskId ? { ...t, done: !next } : t)),
        });
        onError(r.error);
      }
    });
  }

  function removeTask(taskId: string) {
    onPatch(delivery.id, { tasks: delivery.tasks.filter((t) => t.id !== taskId) });
    startTransition(async () => {
      const r = await deleteDeliveryTaskAction(taskId);
      if (!r.ok) onError(r.error);
    });
  }

  function undoDelivery() {
    startTransition(async () => {
      const r = await deleteDeliveryAction(delivery.id);
      if (r.ok) onBoard(r.data);
      else onError(r.error);
    });
  }

  return (
    <Card className="border-border">
      <CardContent className="space-y-3 p-3.5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">{delivery.businessName}</p>
            <p className="text-sm font-medium text-foreground">{delivery.opportunityTitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>
              {meta.label}
            </Badge>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* Status + progress */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={delivery.status}
            onChange={(e) => changeStatus(e.target.value as DeliveryStatus)}
            aria-label="Cambiar estado"
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          {total > 0 && (
            <div className="flex flex-1 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {done}/{total}
              </span>
            </div>
          )}
          <div className="ml-auto">
            {confirmUndo ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">¿Deshacer entrega?</span>
                <button
                  onClick={undoDelivery}
                  disabled={pending}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10"
                >
                  Sí, deshacer
                </button>
                <button
                  onClick={() => setConfirmUndo(false)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmUndo(true)}
                title="Volver a 'Listos para iniciar'"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
              >
                <RotateCcw className="h-3 w-3" />
                Deshacer inicio
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Ocultar detalles" : "Ver detalles"}
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-border pt-3">
            {/* Checklist */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-foreground">Checklist</p>
              {delivery.tasks.map((t) => (
                <div key={t.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => toggleTask(t.id, !t.done)}
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      t.done
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                        : "border-border hover:border-emerald-500/50"
                    )}
                    aria-label={t.done ? "Marcar como pendiente" : "Marcar como hecho"}
                  >
                    {t.done && <Check className="h-3 w-3" />}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-xs",
                      t.done ? "text-muted-foreground line-through" : "text-foreground"
                    )}
                  >
                    {t.title}
                  </span>
                  <button
                    onClick={() => removeTask(t.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                    aria-label="Eliminar tarea"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                  placeholder="Añadir tarea…"
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  onClick={addTask}
                  disabled={!newTask.trim()}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground transition-colors hover:border-primary disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Links */}
            <div className="grid gap-2 sm:grid-cols-2">
              <UrlField
                icon={<GitBranch className="h-3.5 w-3.5" />}
                label="Repositorio"
                value={repoUrl}
                placeholder="https://github.com/…"
                onChange={setRepoUrl}
                onCommit={() => {
                  if (repoUrl !== (delivery.repoUrl ?? "")) saveMeta({ repoUrl });
                }}
              />
              <UrlField
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                label="Despliegue"
                value={deployUrl}
                placeholder="https://…"
                onChange={setDeployUrl}
                onCommit={() => {
                  if (deployUrl !== (delivery.deployUrl ?? "")) saveMeta({ deployUrl });
                }}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-foreground">Notas</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes !== (delivery.notes ?? "")) saveMeta({ notes });
                }}
                rows={2}
                placeholder="Bloqueos, próximos pasos, contexto del cliente…"
                className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function UrlField({
  icon,
  label,
  value,
  placeholder,
  onChange,
  onCommit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="space-y-1">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {icon} {label}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder={placeholder}
          className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        {value.trim() && (
          <a
            href={value.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Abrir ${label}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </label>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "indigo" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "indigo"
        ? "text-indigo-400"
        : accent === "amber"
          ? "text-amber-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className={cn("text-2xl font-semibold leading-none", color)}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ComplexityBadge({ complexity }: { complexity: "low" | "medium" | "high" }) {
  const map = {
    low: { label: "Complejidad baja", cls: "border-emerald-500/30 text-emerald-400" },
    medium: { label: "Complejidad media", cls: "border-amber-500/30 text-amber-400" },
    high: { label: "Complejidad alta", cls: "border-rose-500/30 text-rose-400" },
  } as const;
  const m = map[complexity];
  return (
    <Badge variant="outline" className={cn("text-[10px]", m.cls)}>
      {m.label}
    </Badge>
  );
}

function MiniBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-400">
      {icon}
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
      <Truck className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Aún no hay nada que entregar</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Genera especificaciones de MVP en el MVP Factory. Las que decidas construir aparecerán aquí
        listas para iniciar el seguimiento de la entrega.
      </p>
    </div>
  );
}
