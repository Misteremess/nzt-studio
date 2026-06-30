"use client";

// features/call-prep/components/call-prep-view.tsx
// Call Prep Agent: generates a call/meeting script (agenda, key points,
// objections + responses, discovery questions, next steps) from an
// already-generated commercial proposal.

import { useState, useTransition } from "react";
import {
  PhoneCall,
  Sparkles,
  Loader2,
  AlertTriangle,
  Archive,
  RotateCcw,
  Trash2,
  Inbox,
  ListChecks,
  HelpCircle,
  ShieldQuestion,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import {
  archiveCallScriptAction,
  deleteCallScriptAction,
  generateCallScriptAction,
  listCallScriptsAction,
  restoreCallScriptAction,
} from "@/features/call-prep/actions";
import {
  MEETING_TYPES,
  MEETING_TYPE_META,
  type CallPrepCandidate,
  type CallScriptData,
  type MeetingType,
} from "@/features/call-prep/types";

interface Props {
  initialScripts: CallScriptData[];
  candidates: CallPrepCandidate[];
}

export function CallPrepView({ initialScripts, candidates }: Props) {
  const [scripts, setScripts] = useState<CallScriptData[]>(initialScripts);
  const [selectedId, setSelectedId] = useState<string | null>(initialScripts[0]?.id ?? null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<CallScriptData[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const selected = scripts.find((s) => s.id === selectedId) ?? null;

  function onSaved(script: CallScriptData) {
    setScripts((prev) => {
      const exists = prev.some((s) => s.id === script.id);
      return exists ? prev.map((s) => (s.id === script.id ? script : s)) : [script, ...prev];
    });
    setSelectedId(script.id);
  }

  function onArchive(id: string) {
    setScripts((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  async function toggleArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const r = await listCallScriptsAction(true);
      if (r.ok) setArchived(r.data);
      setLoadingArchived(false);
    }
    setShowArchived((v) => !v);
  }

  function onRestore(id: string) {
    setArchived((prev) => prev.filter((s) => s.id !== id));
    listCallScriptsAction().then((r) => {
      if (r.ok) setScripts(r.data);
    });
  }

  function onDelete(id: string) {
    setArchived((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <PhoneCall className="h-4 w-4" />
          Call Prep Agent
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Genera un guión de llamada o reunión (agenda, puntos clave, objeciones y respuestas,
          preguntas de descubrimiento, próximos pasos) a partir de una propuesta ya enviada.
        </p>
      </div>

      <AiProviderNotice moduleId="call-prep" />

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
          <GenerateForm candidates={candidates} onSaved={onSaved} onError={setError} />

          {scripts.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Guiones generados ({scripts.length})
              </h2>
              <div className="space-y-1.5">
                {scripts.map((s) => {
                  const candidate = candidates.find((c) => c.proposalId === s.proposalId);
                  return (
                    <ScriptListItem
                      key={s.id}
                      script={s}
                      businessName={candidate?.businessName ?? s.proposalId}
                      selected={s.id === selectedId}
                      onSelect={() => setSelectedId(s.id)}
                    />
                  );
                })}
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
                <p className="text-xs text-muted-foreground">No hay guiones archivados.</p>
              ) : (
                archived.map((s) => (
                  <ArchivedScriptCard key={s.id} script={s} onRestored={onRestore} onDeleted={onDelete} />
                ))
              )}
            </section>
          )}
        </div>

        <div className="overflow-y-auto xl:col-span-8">
          {selected ? (
            <ScriptPreview
              script={selected}
              businessName={candidates.find((c) => c.proposalId === selected.proposalId)?.businessName ?? ""}
              onArchived={onArchive}
              onError={setError}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">Genera un guión para verlo aquí.</p>
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
  onSaved,
  onError,
}: {
  candidates: CallPrepCandidate[];
  onSaved: (script: CallScriptData) => void;
  onError: (msg: string) => void;
}) {
  const [proposalId, setProposalId] = useState(candidates[0]?.proposalId ?? "");
  const [meetingType, setMeetingType] = useState<MeetingType>("CALL");
  const [pending, startTransition] = useTransition();

  const candidate = candidates.find((c) => c.proposalId === proposalId) ?? null;

  function generate() {
    if (!candidate) {
      onError("Selecciona una propuesta.");
      return;
    }
    onError("");
    startTransition(async () => {
      const result = await generateCallScriptAction(candidate, meetingType);
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
          Generar guión
        </span>

        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no hay propuestas generadas. Genera una propuesta en Proposal Builder primero.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Propuesta</label>
              <select
                value={proposalId}
                onChange={(e) => setProposalId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              >
                {candidates.map((c) => (
                  <option key={c.proposalId} value={c.proposalId}>
                    {c.businessName} — {c.proposalTitle}
                    {c.hasScript ? " (guión existente)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Tipo de reunión</label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              >
                {MEETING_TYPES.filter((m) => m !== "NONE").map((m) => (
                  <option key={m} value={m}>
                    {MEETING_TYPE_META[m]}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <button
          onClick={generate}
          disabled={pending || candidates.length === 0}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {candidate?.hasScript ? "Regenerar guión" : "Generar guión"}
        </button>
      </CardContent>
    </Card>
  );
}

// ─── List items ─────────────────────────────────────────────────────────────

function ScriptListItem({
  script,
  businessName,
  selected,
  onSelect,
}: {
  script: CallScriptData;
  businessName: string;
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
      <p className="truncate text-xs font-medium text-foreground">{businessName}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {MEETING_TYPE_META[script.meetingType]} · {formatDate(script.updatedAt)}
      </p>
    </button>
  );
}

function ArchivedScriptCard({
  script,
  onRestored,
  onDeleted,
}: {
  script: CallScriptData;
  onRestored: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [isRestoring, startRestore] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleRestore() {
    startRestore(async () => {
      const result = await restoreCallScriptAction(script.id);
      if (result.ok) onRestored(script.id);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteCallScriptAction(script.id);
      if (result.ok) onDeleted(script.id);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-zinc-700 px-3 py-2">
      <p className="truncate text-xs text-foreground/60">{MEETING_TYPE_META[script.meetingType]} · {formatDate(script.updatedAt)}</p>
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

function ScriptPreview({
  script,
  businessName,
  onArchived,
  onError,
}: {
  script: CallScriptData;
  businessName: string;
  onArchived: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [isArchiving, startArchive] = useTransition();

  function handleArchive() {
    startArchive(async () => {
      const result = await archiveCallScriptAction(script.id);
      if (result.ok) onArchived(script.id);
      else onError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{businessName || "Guión"}</h2>
          <p className="text-[11px] text-muted-foreground">
            {MEETING_TYPE_META[script.meetingType]} · Modelo: {script.model}
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

      {script.agenda.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              Agenda de la reunión
            </span>
            <ol className="space-y-2.5">
              {script.agenda.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <p className="text-xs text-muted-foreground">{item}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section icon={<Sparkles className="h-3.5 w-3.5" />} title="Puntos clave" items={script.keyPoints} />
        <Section icon={<HelpCircle className="h-3.5 w-3.5" />} title="Preguntas de descubrimiento" items={script.questions} />
      </div>

      {script.objections.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ShieldQuestion className="h-3.5 w-3.5" />
              Objeciones probables
            </span>
            <div className="divide-y divide-border/60">
              {script.objections.map((o, i) => (
                <details key={i} className="group py-2 first:pt-0 last:pb-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-foreground">
                    {o.objection}
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-1.5 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                    {o.response}
                  </p>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Section icon={<ArrowRight className="h-3.5 w-3.5" />} title="Próximos pasos" items={script.nextSteps} ordered />
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
