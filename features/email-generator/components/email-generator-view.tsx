"use client";

// features/email-generator/components/email-generator-view.tsx
// Email Generator: drafts personalized commercial/follow-up emails from a
// free-text objective, optionally presenting opportunities/MVPs (without
// attaching them) and proposing a meeting (call / Teams / in person).
//
// Layout: left column (40%) holds two generation menus — "Correo
// personalizado" (fully manual) and "Generar con IA" (pick a company +
// opportunities/MVPs and let the AI write the whole email) — plus the list
// of generated drafts. The right column (60%) previews the selected draft.

import { useState, useTransition } from "react";
import {
  Mail,
  Sparkles,
  Loader2,
  AlertTriangle,
  Check,
  Copy,
  RefreshCw,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Building2,
  Inbox,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiProviderNotice } from "@/components/ai/ai-provider-notice";
import {
  archiveEmailDraftAction,
  deleteEmailDraftAction,
  editEmailDraftAction,
  generateEmailDraftAction,
  listEmailDraftsAction,
  regenerateEmailDraftAction,
  restoreEmailDraftAction,
} from "@/features/email-generator/actions";
import {
  MEETING_TYPES,
  MEETING_TYPE_META,
  type EmailDraftData,
  type EmailGeneratorBusiness,
  type EmailReference,
  type MeetingType,
} from "@/features/email-generator/types";

interface Props {
  initialDrafts: EmailDraftData[];
  businesses: EmailGeneratorBusiness[];
}

const EMPTY_REFS: EmailReference[] = [];

export function EmailGeneratorView({ initialDrafts, businesses }: Props) {
  const [drafts, setDrafts] = useState<EmailDraftData[]>(initialDrafts);
  const [selectedId, setSelectedId] = useState<string | null>(initialDrafts[0]?.id ?? null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<EmailDraftData[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const selectedDraft = drafts.find((d) => d.id === selectedId) ?? null;

  function onCreated(draft: EmailDraftData) {
    setDrafts((prev) => [draft, ...prev]);
    setSelectedId(draft.id);
  }

  function onUpdated(draft: EmailDraftData) {
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
  }

  function onArchive(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  async function toggleArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const r = await listEmailDraftsAction(true);
      if (r.ok) setArchived(r.data);
      setLoadingArchived(false);
    }
    setShowArchived((v) => !v);
  }

  function onRestore(id: string) {
    setArchived((prev) => prev.filter((d) => d.id !== id));
    listEmailDraftsAction().then((r) => {
      if (r.ok) setDrafts(r.data);
    });
  }

  function onDelete(id: string) {
    setArchived((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
          <Mail className="h-4 w-4" />
          Email Generator
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Redacta correos comerciales y de seguimiento personalizados con IA: presenta
          oportunidades o MVPs sin adjuntarlos, propón una reunión, o escribe un correo
          totalmente independiente a partir de un objetivo.
        </p>
      </div>

      <AiProviderNotice moduleId="email-generator" />

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 lg:col-span-2">
          <PersonalizedEmailForm onCreated={onCreated} onError={setError} />
          <AiGenerateForm businesses={businesses} onCreated={onCreated} onError={setError} />

          {drafts.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Correos generados ({drafts.length})
              </h2>
              <div className="space-y-1.5">
                {drafts.map((d) => (
                  <DraftListItem
                    key={d.id}
                    draft={d}
                    selected={d.id === selectedId}
                    onSelect={() => setSelectedId(d.id)}
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
                <p className="text-xs text-muted-foreground">No hay correos archivados.</p>
              ) : (
                archived.map((d) => (
                  <ArchivedDraftCard key={d.id} draft={d} onRestored={onRestore} onDeleted={onDelete} />
                ))
              )}
            </section>
          )}
        </div>

        <div className="overflow-y-auto lg:col-span-3">
          <PreviewPane draft={selectedDraft} onUpdated={onUpdated} onArchived={onArchive} onError={setError} />
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────────

function CollapsibleCard({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            {icon}
            {title}
          </span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        {open && <div className="space-y-3">{children}</div>}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />
    </label>
  );
}

function MeetingFields({
  meetingType,
  setMeetingType,
  meetingNotes,
  setMeetingNotes,
}: {
  meetingType: MeetingType;
  setMeetingType: (v: MeetingType) => void;
  meetingNotes: string;
  setMeetingNotes: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Reunión a proponer</label>
        <select
          value={meetingType}
          onChange={(e) => setMeetingType(e.target.value as MeetingType)}
          className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
        >
          {MEETING_TYPES.map((m) => (
            <option key={m} value={m}>
              {MEETING_TYPE_META[m]}
            </option>
          ))}
        </select>
      </div>
      {meetingType !== "NONE" && (
        <Field
          label="Preferencias de horario / lugar"
          value={meetingNotes}
          onChange={setMeetingNotes}
          placeholder="Ej: martes o miércoles por la tarde"
        />
      )}
    </div>
  );
}

// ─── Menu 1: correo personalizado (manual) ──────────────────────────────────────

function PersonalizedEmailForm({
  onCreated,
  onError,
}: {
  onCreated: (draft: EmailDraftData) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [objective, setObjective] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRole, setRecipientRole] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("NONE");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function generate() {
    const obj = objective.trim();
    if (!obj) {
      onError("Indica el objetivo del correo.");
      return;
    }
    onError("");
    startTransition(async () => {
      const result = await generateEmailDraftAction({
        objective: obj,
        recipientName,
        recipientRole,
        businessName,
        senderName,
        meetingType,
        meetingNotes,
        references: EMPTY_REFS,
      });
      if (result.ok) {
        onCreated(result.data);
        setObjective("");
        setMeetingNotes("");
      } else {
        onError(result.error);
      }
    });
  }

  return (
    <CollapsibleCard title="Correo personalizado" icon={<Pencil className="h-3.5 w-3.5" />} open={open} onToggle={() => setOpen((v) => !v)}>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Objetivo del correo *</label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          placeholder="Ej: Vender nuestros servicios de agentes de IA a este negocio. Ej: Hacer seguimiento de la propuesta enviada y proponer una llamada."
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <div className="space-y-2.5">
        <Field label="Nombre del destinatario" value={recipientName} onChange={setRecipientName} placeholder="María…" />
        <Field label="Cargo del destinatario" value={recipientRole} onChange={setRecipientRole} placeholder="Gerente…" />
        <Field label="Empresa / negocio" value={businessName} onChange={setBusinessName} placeholder="Opcional" />
        <Field label="Firma (remitente)" value={senderName} onChange={setSenderName} placeholder="Tu nombre" />
      </div>

      <MeetingFields
        meetingType={meetingType}
        setMeetingType={setMeetingType}
        meetingNotes={meetingNotes}
        setMeetingNotes={setMeetingNotes}
      />

      <button
        onClick={generate}
        disabled={pending || !objective.trim()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Generar correo con IA
      </button>
    </CollapsibleCard>
  );
}

// ─── Menu 2: generar con IA a partir de empresa + propuestas/MVPs ───────────────

function AiGenerateForm({
  businesses,
  onCreated,
  onError,
}: {
  businesses: EmailGeneratorBusiness[];
  onCreated: (draft: EmailDraftData) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<EmailGeneratorBusiness | null>(null);
  const [selectedRefs, setSelectedRefs] = useState<Map<string, EmailReference>>(new Map());
  const [objective, setObjective] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRole, setRecipientRole] = useState("");
  const [senderName, setSenderName] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("NONE");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function selectBusiness(placeId: string) {
    const b = businesses.find((x) => x.placeId === placeId) ?? null;
    setSelectedBusiness(b);
    setSelectedRefs(new Map());
  }

  function toggleRef(ref: EmailReference) {
    setSelectedRefs((prev) => {
      const next = new Map(prev);
      if (next.has(ref.opportunityId)) next.delete(ref.opportunityId);
      else next.set(ref.opportunityId, ref);
      return next;
    });
  }

  function generate() {
    if (!selectedBusiness) {
      onError("Selecciona una empresa.");
      return;
    }
    onError("");
    const refs = Array.from(selectedRefs.values());
    const obj =
      objective.trim() ||
      `Presentar nuestras oportunidades/MVPs detectados a ${selectedBusiness.businessName} y proponer un siguiente paso.`;

    startTransition(async () => {
      const result = await generateEmailDraftAction({
        objective: obj,
        recipientName,
        recipientRole,
        businessName: selectedBusiness.businessName,
        senderName,
        meetingType,
        meetingNotes,
        references: refs,
      });
      if (result.ok) {
        onCreated(result.data);
        setObjective("");
        setMeetingNotes("");
      } else {
        onError(result.error);
      }
    });
  }

  return (
    <CollapsibleCard
      title="Generar con IA (empresa + propuestas)"
      icon={<Building2 className="h-3.5 w-3.5" />}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Empresa / negocio *</label>
        <select
          value={selectedBusiness?.placeId ?? ""}
          onChange={(e) => selectBusiness(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
        >
          <option value="">Selecciona una empresa…</option>
          {businesses.map((b) => (
            <option key={b.placeId} value={b.placeId}>
              {b.businessName}
            </option>
          ))}
        </select>
        {businesses.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            No hay oportunidades detectadas todavía.
          </p>
        )}
      </div>

      {selectedBusiness && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Oportunidades / MVPs a presentar{" "}
            {selectedRefs.size > 0 ? `(${selectedRefs.size} seleccionadas)` : "(opcional)"}
          </label>
          {selectedBusiness.opportunities.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Esta empresa no tiene oportunidades/MVPs registrados.
            </p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2.5">
              {selectedBusiness.opportunities.map((o) => (
                <label
                  key={o.opportunityId}
                  className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={selectedRefs.has(o.opportunityId)}
                    onChange={() => toggleRef(o)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="font-medium text-foreground">{o.title}</span>
                    {o.pitch && <span className="text-muted-foreground"> — {o.pitch}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          Objetivo del correo (opcional, personalízalo si quieres)
        </label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={2}
          placeholder="Ej: Presentar estas oportunidades y proponer una llamada de 15 minutos."
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <div className="space-y-2.5">
        <Field label="Nombre del destinatario" value={recipientName} onChange={setRecipientName} placeholder="María…" />
        <Field label="Cargo del destinatario" value={recipientRole} onChange={setRecipientRole} placeholder="Gerente…" />
        <Field label="Firma (remitente)" value={senderName} onChange={setSenderName} placeholder="Tu nombre" />
      </div>

      <MeetingFields
        meetingType={meetingType}
        setMeetingType={setMeetingType}
        meetingNotes={meetingNotes}
        setMeetingNotes={setMeetingNotes}
      />

      <button
        onClick={generate}
        disabled={pending || !selectedBusiness}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Generar correo con IA
      </button>
    </CollapsibleCard>
  );
}

// ─── Drafts list (left column) ───────────────────────────────────────────────────

function DraftListItem({
  draft,
  selected,
  onSelect,
}: {
  draft: EmailDraftData;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border hover:border-primary/30 hover:bg-secondary/20"
      )}
    >
      <p className="truncate text-xs font-medium text-foreground">{draft.subject || "(sin asunto)"}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {[draft.recipientName, draft.businessName].filter(Boolean).join(" — ") || draft.objective}
      </p>
    </button>
  );
}

// ─── Preview pane (right column) ─────────────────────────────────────────────────

function PreviewPane({
  draft,
  onUpdated,
  onArchived,
  onError,
}: {
  draft: EmailDraftData | null;
  onUpdated: (draft: EmailDraftData) => void;
  onArchived: (id: string) => void;
  onError: (msg: string) => void;
}) {
  if (!draft) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Sin correo seleccionado</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Genera un correo personalizado o con IA desde la columna izquierda, o selecciona uno de
          la lista de correos generados para previsualizarlo aquí.
        </p>
      </div>
    );
  }

  return <DraftCard draft={draft} onUpdated={onUpdated} onArchived={() => onArchived(draft.id)} onError={onError} />;
}

// ─── Draft card ─────────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  onUpdated,
  onArchived,
  onError,
}: {
  draft: EmailDraftData;
  onUpdated: (draft: EmailDraftData) => void;
  onArchived: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, startTransition] = useTransition();

  function startEditing() {
    setSubject(draft.subject);
    setBody(draft.body);
    setEditing(true);
  }

  function copy() {
    navigator.clipboard
      .writeText(`Asunto: ${draft.subject}\n\n${draft.body}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  function regenerate() {
    startTransition(async () => {
      const r = await regenerateEmailDraftAction(draft.id);
      if (r.ok) onUpdated(r.data);
      else onError(r.error);
    });
  }

  function saveEdits() {
    startTransition(async () => {
      const r = await editEmailDraftAction(draft.id, { subject, body });
      if (r.ok) {
        onUpdated(r.data);
        setEditing(false);
      } else {
        onError(r.error);
      }
    });
  }

  function archive() {
    startTransition(async () => {
      const r = await archiveEmailDraftAction(draft.id);
      if (r.ok) onArchived();
      else onError(r.error);
    });
  }

  return (
    <Card className="border-border">
      <CardContent className="space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            {(draft.recipientName || draft.businessName) && (
              <p className="truncate text-[11px] text-muted-foreground">
                Para: {[draft.recipientName, draft.businessName].filter(Boolean).join(" — ")}
              </p>
            )}
            <p className="line-clamp-2 text-xs text-muted-foreground">
              <Lightbulb className="mr-1 inline h-3 w-3 text-amber-400" />
              {draft.objective}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {draft.meetingType !== "NONE" && (
              <Badge variant="outline" className="text-[10px]">
                {MEETING_TYPE_META[draft.meetingType]}
              </Badge>
            )}
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {draft.references.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {draft.references.map((r) => (
              <Badge key={r.opportunityId} variant="outline" className="text-[10px]">
                {r.title}
              </Badge>
            ))}
          </div>
        )}

        {editing ? (
          <div className="space-y-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSubject(draft.subject);
                  setBody(draft.body);
                  setEditing(false);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdits}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-md border border-border bg-secondary/20 p-3">
            <p className="text-sm font-semibold text-foreground">{draft.subject}</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{draft.body}</p>
          </div>
        )}

        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <IconAction onClick={copy} title="Copiar">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </IconAction>
            <IconAction onClick={startEditing} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </IconAction>
            <IconAction onClick={regenerate} disabled={pending} title="Regenerar">
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerar
            </IconAction>
            {confirmArchive ? (
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">¿Archivar?</span>
                <button onClick={archive} className="font-medium text-rose-400 hover:underline">
                  Sí
                </button>
                <button onClick={() => setConfirmArchive(false)} className="text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
              </span>
            ) : (
              <IconAction onClick={() => setConfirmArchive(true)} title="Archivar" className="ml-auto">
                <Archive className="h-3.5 w-3.5" />
                Archivar
              </IconAction>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IconAction({
  onClick,
  disabled,
  title,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

// ─── Archived draft card ──────────────────────────────────────────────────────

function ArchivedDraftCard({
  draft,
  onRestored,
  onDeleted,
}: {
  draft: EmailDraftData;
  onRestored: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function restore() {
    startTransition(async () => {
      const r = await restoreEmailDraftAction(draft.id);
      if (r.ok) onRestored(draft.id);
    });
  }

  function remove() {
    startTransition(async () => {
      const r = await deleteEmailDraftAction(draft.id);
      if (r.ok) onDeleted(draft.id);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground/70">{draft.subject || "(sin asunto)"}</p>
        <p className="truncate text-[11px] text-muted-foreground">{draft.objective}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={restore}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Restaurar
        </button>
        {confirmDelete ? (
          <>
            <button onClick={remove} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-muted-foreground hover:text-rose-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
