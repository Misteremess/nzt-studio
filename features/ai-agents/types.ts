// features/ai-agents/types.ts
// Client-safe types for AI Agents — a registry of NZT Studio's own AI agents
// (WhatsApp Business, Email, Phone via ElevenLabs) deployed for clients or
// for internal use. Plain CRUD, no AI generation.

export type AgentChannel = "WHATSAPP" | "EMAIL" | "PHONE";

export const AGENT_CHANNELS: AgentChannel[] = ["WHATSAPP", "EMAIL", "PHONE"];

export interface AgentChannelMeta {
  label: string;
  badge: string; // Tailwind classes for the chip
}

export const AGENT_CHANNEL_META: Record<AgentChannel, AgentChannelMeta> = {
  WHATSAPP: { label: "WhatsApp Business", badge: "border-emerald-500/30 text-emerald-400" },
  EMAIL: { label: "Correo", badge: "border-sky-500/30 text-sky-400" },
  PHONE: { label: "Teléfono (ElevenLabs)", badge: "border-violet-500/30 text-violet-400" },
};

export type AgentStatus = "ACTIVE" | "PAUSED" | "DRAFT";

export const AGENT_STATUSES: AgentStatus[] = ["ACTIVE", "PAUSED", "DRAFT"];

export interface AgentStatusMeta {
  label: string;
  badge: string;
}

export const AGENT_STATUS_META: Record<AgentStatus, AgentStatusMeta> = {
  ACTIVE: { label: "Activo", badge: "border-emerald-500/30 text-emerald-400" },
  PAUSED: { label: "En pausa", badge: "border-amber-500/30 text-amber-400" },
  DRAFT: { label: "Borrador", badge: "border-zinc-500/40 text-zinc-300" },
};

export interface AgentItem {
  id: string;
  name: string;
  channel: AgentChannel;
  status: AgentStatus;
  description: string;
  clientName: string;
  phoneNumber: string;
  emailAddress: string;
  elevenLabsAgentId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentData {
  items: AgentItem[];
  countsByChannel: Record<AgentChannel, number>;
  countsByStatus: Record<AgentStatus, number>;
}

/** Payload for create/update. */
export interface AgentInput {
  name: string;
  channel: AgentChannel;
  status: AgentStatus;
  description: string;
  clientName: string;
  phoneNumber: string;
  emailAddress: string;
  elevenLabsAgentId: string;
  notes: string;
}
