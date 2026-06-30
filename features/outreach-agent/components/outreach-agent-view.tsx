"use client";

// features/outreach-agent/components/outreach-agent-view.tsx
// Outreach Agent: generates a 3-step follow-up sequence (different angle per
// email) for a business that already has an AI-detected opportunity and a
// generated proposal.

import { useState, useTransition } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  AlertTriangle,
  Check,
  Copy,
  Archive,
  RotateCcw,
  Trash2,
  Inbox,
  Clock,
  Mail,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import {
  archiveOutreachSequenceAction,
  deleteOutreachSequenceAction,
  generateOutreachSequenceAction,
  listOutreachSequencesAction,
  regenerateOutreachStepAction,
  restoreOutreachSequenceAction,
  updateOutreachStepAction,
} from "@/features/outreach-agent/actions";
import type {
  OutreachCandidate,
  OutreachSequenceData,
  OutreachStep,
  OutreachStepStatus,
} from "@/features/outreach-agent/types";

interface Props {
  initialSequences: OutreachSequenceData[];
  candidates: OutreachCandidate[];
}

export function OutreachAgentView({ initialSequences, candidates }: Props) {
  const [sequences, setSequences] = useState<OutreachSequenceData[]>(initialSequences);
  const [selectedId, setSelectedId] = useState<string | null>(initialSequences[0]?.id ?? null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<OutreachSequenceData[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const selected = sequences.find((s) => s.id === selectedId) ?? null;

  function onCreated(seq: OutreachSequenceData) {
    setSequences((prev) => [seq, ...prev]);
    setSelectedId(seq.id);
  }

  function onArchive(id: string) {
    setSequences((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  function onUpdated(updated: OutreachSequenceData) {
    setSequences((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function toggleArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const r = await listOutreachSequencesAction(true);
      if (r.ok) setArchived(r.data);
      setLoadingArchived(false);
    }
    setShowArchived((v) => !v);
  }

  function onRestore(id: string) {
    setArchived((prev) => prev.filter((s) => s.id !== id));
    listOutreachSequencesAction().then((r) => {
      if (r.ok) setSequences(r.data);
    });
  }

  function onDelete(id: string) {
    setArchived((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <Send className="h-4 w-4" />
          Outreach Agent
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Genera una secuencia de 3 correos de seguimiento (ángulos distintos) para negocios
          que ya tienen una oportunidad y propuesta generadas.
        </p>
      </div>

      <AiProviderNotice moduleId="outreach-agent" />

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
          <GenerateForm candidates={candidates} onCreated={onCreated} onError={setError} />

          {sequences.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Secuencias generadas ({sequences.length})
              </h2>
              <div className="space-y-1.5">
                {sequences.map((s) => (
                  <SequenceListItem
                    key={s.id}
                    sequence={s}
                    selected={s.id === selectedId}
                    onSelect={() => setSelectedId(s.id)}
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
              {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
            </button>
          </div>

          {showArchived && (
            <section className="space-y-2">
              {archived.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay secuencias archivadas.</p>
              ) : (
                archived.map((s) => (
                  <ArchivedSequenceCard key={s.id} sequence={s} onRestored={onRestore} onDeleted={onDelete} />
                ))
              )}
            </section>
          )}
        </div>

        <div className="overflow-y-auto xl:col-span-8">
          {selected ? (
            <SequencePreview sequence={selected} onArchived={onArchive} onUpdated={onUpdated} onError={setError} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">Genera una secuencia para verla aquí.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generate form ──────────────────────────────────────────────────────────

function GenerateForm({
  candidates,
  onCreated,
  onError,
}: {
  candidates: OutreachCandidate[];
  onCreated: (seq: OutreachSequenceData) => void;
  onError: (msg: string) => void;
}) {
  const [placeId, setPlaceId] = useState(candidates[0]?.placeId ?? "");
  const [pending, startTransition] = useTransition();

  const candidate = candidates.find((c) => c.placeId === placeId) ?? null;

  function generate() {
    if (!candidate) {
      onError("Selecciona un negocio.");
      return;
    }
    onError("");
    startTransition(async () => {
      const result = await generateOutreachSequenceAction(candidate);
      if (result.ok) {
        onCreated(result.data);
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
          Generar secuencia
        </span>

        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no hay negocios con oportunidad y propuesta generadas. Genera una propuesta en
            Proposal Builder primero.
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
                </option>
              ))}
            </select>
            {candidate && (
              <p className="pt-1 text-[11px] text-muted-foreground">
                Oportunidad: {candidate.opportunityTitle} · Propuesta: {candidate.proposalTitle}
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
          Generar secuencia
        </button>
      </CardContent>
    </Card>
  );
}

// ─── List items ─────────────────────────────────────────────────────────────

function SequenceListItem({
  sequence,
  selected,
  onSelect,
}: {
  sequence: OutreachSequenceData;
  selected: boolean;
  onSelect: () => void;
}) {
  const sentCount = sequence.steps.filter((s) => s.status !== "pending").length;
  const next = sequence.steps.find((s) => s.status === "pending");

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
      }`}
    >
      <p className="truncate text-xs font-medium text-foreground">{sequence.businessName}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {sentCount}/{sequence.steps.length} enviados · {formatDate(sequence.updatedAt)}
      </p>
      {next && (
        <p className="mt-0.5 truncate text-[11px] text-primary/80">
          Siguiente: Paso {next.stepNumber} {next.angle ? `· ${next.angle}` : ""}
        </p>
      )}
    </button>
  );
}

function ArchivedSequenceCard({
  sequence,
  onRestored,
  onDeleted,
}: {
  sequence: OutreachSequenceData;
  onRestored: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [isRestoring, startRestore] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleRestore() {
    startRestore(async () => {
      const result = await restoreOutreachSequenceAction(sequence.id);
      if (result.ok) onRestored(sequence.id);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteOutreachSequenceAction(sequence.id);
      if (result.ok) onDeleted(sequence.id);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-zinc-700 px-3 py-2">
      <p className="truncate text-xs text-foreground/60">{sequence.businessName}</p>
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

function SequencePreview({
  sequence,
  onArchived,
  onUpdated,
  onError,
}: {
  sequence: OutreachSequenceData;
  onArchived: (id: string) => void;
  onUpdated: (seq: OutreachSequenceData) => void;
  onError: (msg: string) => void;
}) {
  const [isArchiving, startArchive] = useTransition();

  function handleArchive() {
    startArchive(async () => {
      const result = await archiveOutreachSequenceAction(sequence.id);
      if (result.ok) onArchived(sequence.id);
      else onError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{sequence.businessName}</h2>
          <p className="text-[11px] text-muted-foreground">
            Modelo: {sequence.model}
            {sequence.recipientEmail ? ` · ${sequence.recipientEmail}` : ""}
          </p>
        </div>
        <button
          onClick={handleArchive}
          disabled={isArchiving}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {isArchiving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
          Archivar
        </button>
      </div>

      {!sequence.recipientEmail && (
        <p className="text-[11px] text-muted-foreground">
          Este negocio no tiene un email de contacto guardado en CRM, así que no se puede abrir el
          borrador directamente en tu cliente de correo.
        </p>
      )}

      <div className="relative space-y-4 pl-9">
        <div className="absolute bottom-3 left-[15px] top-3 w-px bg-border" aria-hidden />
        {sequence.steps.map((step) => (
          <div key={step.stepNumber} className="relative">
            <div className="absolute -left-9 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
              {step.stepNumber}
            </div>
            <StepCard
              sequenceId={sequence.id}
              step={step}
              recipientEmail={sequence.recipientEmail}
              onUpdated={onUpdated}
              onError={onError}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<OutreachStepStatus, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  replied: "Respondido",
  no_response: "Sin respuesta",
};

const STATUS_BADGE_CLASSES: Record<OutreachStepStatus, string> = {
  pending: "border-border text-muted-foreground",
  sent: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  replied: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  no_response: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

function StepCard({
  sequenceId,
  step,
  recipientEmail,
  onUpdated,
  onError,
}: {
  sequenceId: string;
  step: OutreachStep;
  recipientEmail: string | null;
  onUpdated: (seq: OutreachSequenceData) => void;
  onError: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(step.subject);
  const [bodyDraft, setBodyDraft] = useState(step.body);
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isSavingStatus, startSavingStatus] = useTransition();
  const [isSavingEdit, startSavingEdit] = useTransition();
  const [isRegenerating, startRegenerate] = useTransition();

  function copy() {
    navigator.clipboard.writeText(`${step.subject}\n\n${step.body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function changeStatus(status: OutreachStepStatus) {
    startSavingStatus(async () => {
      const sentAt = status === "pending" ? null : step.sentAt ?? new Date().toISOString();
      const result = await updateOutreachStepAction(sequenceId, step.stepNumber, { status, sentAt });
      if (result.ok) onUpdated(result.data);
      else onError(result.error);
    });
  }

  function startEdit() {
    setSubjectDraft(step.subject);
    setBodyDraft(step.body);
    setIsEditing(true);
  }

  function saveEdit() {
    startSavingEdit(async () => {
      const result = await updateOutreachStepAction(sequenceId, step.stepNumber, {
        subject: subjectDraft,
        body: bodyDraft,
      });
      if (result.ok) {
        onUpdated(result.data);
        setIsEditing(false);
      } else {
        onError(result.error);
      }
    });
  }

  function regenerate() {
    startRegenerate(async () => {
      const result = await regenerateOutreachStepAction(sequenceId, step.stepNumber, instruction.trim() || undefined);
      if (result.ok) {
        onUpdated(result.data);
        setShowRegenInput(false);
        setInstruction("");
      } else {
        onError(result.error);
      }
    });
  }

  const mailtoHref = recipientEmail
    ? `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(step.subject)}&body=${encodeURIComponent(step.body)}`
    : null;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              Paso {step.stepNumber}
            </Badge>
            {step.angle && <span className="text-xs font-medium text-foreground">{step.angle}</span>}
            <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLASSES[step.status]}`}>
              {STATUS_LABELS[step.status]}
            </Badge>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {step.delayDays === 0 ? "Inmediato" : `+${step.delayDays} días`}
          </span>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <input
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              placeholder="Asunto"
            />
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed text-foreground outline-none focus:border-primary"
              placeholder="Cuerpo del correo"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveEdit}
                disabled={isSavingEdit}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSavingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Guardar
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSavingEdit}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-foreground">{step.subject}</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{step.body}</p>
          </>
        )}

        {!isEditing && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>

            {mailtoHref && (
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-3 w-3" />
                Abrir en email
              </a>
            )}

            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>

            <button
              onClick={() => setShowRegenInput((v) => !v)}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {isRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Regenerar
            </button>

            <select
              value={step.status}
              onChange={(e) => changeStatus(e.target.value as OutreachStepStatus)}
              disabled={isSavingStatus}
              className="ml-auto h-6 rounded-md border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:border-primary disabled:opacity-50"
            >
              {(Object.keys(STATUS_LABELS) as OutreachStepStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        {showRegenInput && !isEditing && (
          <div className="flex items-center gap-2 pt-1">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Instrucción opcional (ej. más corto, menciona un descuento...)"
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary"
            />
            <button
              onClick={regenerate}
              disabled={isRegenerating}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Regenerar
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
