"use client";

// features/ai-agents/components/ai-agents-view.tsx
// Registry of NZT Studio's own AI agents (WhatsApp Business, Email, Phone via
// ElevenLabs) deployed for clients or for internal use. Plain CRUD.

import { useMemo, useState, useTransition } from "react";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Phone,
  Mail,
  MessageCircle,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createAgentAction, deleteAgentAction, updateAgentAction } from "@/features/ai-agents/actions";
import {
  AGENT_CHANNEL_META,
  AGENT_CHANNELS,
  AGENT_STATUS_META,
  AGENT_STATUSES,
  type AgentChannel,
  type AgentData,
  type AgentInput,
  type AgentItem,
  type AgentStatus,
} from "@/features/ai-agents/types";

interface Props {
  initialData: AgentData;
}

const EMPTY_FORM: AgentInput = {
  name: "",
  channel: "WHATSAPP",
  status: "ACTIVE",
  description: "",
  clientName: "",
  phoneNumber: "",
  emailAddress: "",
  elevenLabsAgentId: "",
  notes: "",
};

const CHANNEL_ICON: Record<AgentChannel, React.ReactNode> = {
  WHATSAPP: <MessageCircle className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  PHONE: <Phone className="h-3.5 w-3.5" />,
};

export function AiAgentsView({ initialData }: Props) {
  const [data, setData] = useState<AgentData>(initialData);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const [channelFilter, setChannelFilter] = useState<AgentChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");

  const [editing, setEditing] = useState<AgentItem | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    return data.items.filter((it) => {
      if (channelFilter !== "all" && it.channel !== channelFilter) return false;
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      return true;
    });
  }, [data.items, channelFilter, statusFilter]);

  function save(input: AgentInput) {
    setError("");
    startTransition(async () => {
      const result = editing
        ? await updateAgentAction(editing.id, input)
        : await createAgentAction(input);
      if (result.ok) {
        setData(result.data);
        setEditing(null);
        setCreating(false);
      } else {
        setError(result.error);
      }
    });
  }

  function remove(id: string) {
    setError("");
    startTransition(async () => {
      const result = await deleteAgentAction(id);
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
  }

  const showEditor = creating || editing !== null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
            <Bot className="h-4 w-4" />
            AI Agents
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Agentes de IA propios de NZT Studio: WhatsApp Business, correo y llamadas (ElevenLabs).
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setCreating(true);
            setError("");
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo agente
        </button>
      </div>

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      {showEditor && (
        <Editor
          initial={editing ?? EMPTY_FORM}
          isEdit={editing !== null}
          pending={pending}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={save}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={channelFilter === "all"} onClick={() => setChannelFilter("all")}>
          Todos los canales ({data.items.length})
        </FilterChip>
        {AGENT_CHANNELS.map((c) => (
          <FilterChip
            key={c}
            active={channelFilter === c}
            onClick={() => setChannelFilter(c)}
            disabled={data.countsByChannel[c] === 0}
          >
            {AGENT_CHANNEL_META[c].label} ({data.countsByChannel[c]})
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          Todos los estados
        </FilterChip>
        {AGENT_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            disabled={data.countsByStatus[s] === 0}
          >
            {AGENT_STATUS_META[s].label} ({data.countsByStatus[s]})
          </FilterChip>
        ))}
      </div>

      {/* Agents grid */}
      {data.items.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} de {data.items.length} agentes
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((it) => (
              <AgentCard
                key={it.id}
                item={it}
                pending={pending}
                onEdit={() => {
                  setCreating(false);
                  setEditing(it);
                  setError("");
                }}
                onDelete={() => remove(it.id)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Ningún agente coincide con los filtros.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Editor({
  initial,
  isEdit,
  pending,
  onCancel,
  onSave,
}: {
  initial: AgentInput;
  isEdit: boolean;
  pending: boolean;
  onCancel: () => void;
  onSave: (input: AgentInput) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [channel, setChannel] = useState<AgentChannel>(initial.channel);
  const [status, setStatus] = useState<AgentStatus>(initial.status);
  const [description, setDescription] = useState(initial.description);
  const [clientName, setClientName] = useState(initial.clientName);
  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber);
  const [emailAddress, setEmailAddress] = useState(initial.emailAddress);
  const [elevenLabsAgentId, setElevenLabsAgentId] = useState(initial.elevenLabsAgentId);
  const [notes, setNotes] = useState(initial.notes);

  const valid = name.trim().length > 0;

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {isEdit ? "Editar agente" : "Nuevo agente"}
          </p>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del agente…"
            className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary sm:col-span-1"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as AgentChannel)}
            aria-label="Canal"
            className="h-9 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
          >
            {AGENT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {AGENT_CHANNEL_META[c].label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AgentStatus)}
            aria-label="Estado"
            className="h-9 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
          >
            {AGENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AGENT_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>

        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Cliente / negocio (vacío si es interno de NZT)…"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Para qué sirve este agente…"
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />

        {/* Channel-specific fields */}
        <div className="grid gap-3 sm:grid-cols-2">
          {(channel === "WHATSAPP" || channel === "PHONE") && (
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Número de teléfono…"
              className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          )}
          {channel === "EMAIL" && (
            <input
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="Dirección de correo…"
              className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          )}
          {channel === "PHONE" && (
            <input
              value={elevenLabsAgentId}
              onChange={(e) => setElevenLabsAgentId(e.target.value)}
              placeholder="ID del agente en ElevenLabs…"
              className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          )}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notas libres (prompts, configuración, incidencias…)"
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              valid &&
              onSave({
                name,
                channel,
                status,
                description,
                clientName,
                phoneNumber,
                emailAddress,
                elevenLabsAgentId,
                notes,
              })
            }
            disabled={!valid || pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {isEdit ? "Guardar" : "Crear"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({
  item,
  pending,
  onEdit,
  onDelete,
}: {
  item: AgentItem;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const channelMeta = AGENT_CHANNEL_META[item.channel];
  const statusMeta = AGENT_STATUS_META[item.status];

  return (
    <Card className="flex flex-col border-border">
      <CardContent className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("inline-flex items-center gap-1 text-[10px]", channelMeta.badge)}>
              {CHANNEL_ICON[item.channel]}
              {channelMeta.label}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px]", statusMeta.badge)}>
              {statusMeta.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn title="Editar" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            {confirming ? (
              <button
                onClick={onDelete}
                disabled={pending}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-400 hover:bg-rose-500/10"
              >
                ¿Borrar?
              </button>
            ) : (
              <IconBtn title="Eliminar" onClick={() => setConfirming(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            )}
          </div>
        </div>

        <p className="text-sm font-medium leading-snug text-foreground">{item.name}</p>

        {item.clientName && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" /> {item.clientName}
          </p>
        )}

        {item.description && (
          <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        )}

        <div className="mt-auto space-y-0.5 pt-1 text-[11px] text-muted-foreground">
          {item.phoneNumber && <p>Tel: {item.phoneNumber}</p>}
          {item.emailAddress && <p>Email: {item.emailAddress}</p>}
          {item.elevenLabsAgentId && <p>ElevenLabs ID: {item.elevenLabsAgentId}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
      <Bot className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">Aún no has registrado ningún agente</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Lleva el control de los agentes de IA de NZT Studio: WhatsApp Business, correo y
          llamadas vía ElevenLabs, propios o desplegados para clientes.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" />
        Crear el primero
      </button>
    </div>
  );
}
