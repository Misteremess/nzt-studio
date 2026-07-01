"use server";
// features/ai-agents/actions.ts
// Server Actions for AI Agents: create, update and delete agents.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { createAgent, deleteAgent, getAgentData, updateAgent } from "@/features/ai-agents/lib/store";
import {
  AGENT_CHANNELS,
  AGENT_STATUSES,
  type AgentChannel,
  type AgentData,
  type AgentInput,
  type AgentStatus,
} from "@/features/ai-agents/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

function isChannel(v: string): v is AgentChannel {
  return (AGENT_CHANNELS as string[]).includes(v);
}

function isStatus(v: string): v is AgentStatus {
  return (AGENT_STATUSES as string[]).includes(v);
}

function validate(input: unknown): AgentInput | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.channel !== "string" || !isChannel(r.channel)) return null;
  if (typeof r.status !== "string" || !isStatus(r.status)) return null;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    name: name.slice(0, 200),
    channel: r.channel,
    status: r.status,
    description: str(r.description),
    clientName: str(r.clientName),
    phoneNumber: str(r.phoneNumber),
    emailAddress: str(r.emailAddress),
    elevenLabsAgentId: str(r.elevenLabsAgentId),
    notes: str(r.notes),
  };
}

export async function createAgentAction(input: unknown): Promise<ActionResult<AgentData>> {
  await requireSession();
  const clean = validate(input);
  if (!clean) return { ok: false, error: "Falta el nombre o el canal no es válido.", errorCode: "INVALID_INPUT" };
  try {
    await createAgent(clean);
    revalidatePath("/ai-agents");
    return { ok: true, data: await getAgentData() };
  } catch {
    return { ok: false, error: "No se pudo crear el agente.", errorCode: "DB_ERROR" };
  }
}

export async function updateAgentAction(id: string, input: unknown): Promise<ActionResult<AgentData>> {
  await requireSession();
  if (!id) return { ok: false, error: "Agente no válido.", errorCode: "INVALID_INPUT" };
  const clean = validate(input);
  if (!clean) return { ok: false, error: "Falta el nombre o el canal no es válido.", errorCode: "INVALID_INPUT" };
  try {
    await updateAgent(id, clean);
    revalidatePath("/ai-agents");
    return { ok: true, data: await getAgentData() };
  } catch {
    return { ok: false, error: "No se pudo guardar el agente.", errorCode: "DB_ERROR" };
  }
}

export async function deleteAgentAction(id: string): Promise<ActionResult<AgentData>> {
  await requireSession();
  if (!id) return { ok: false, error: "Agente no válido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteAgent(id);
    revalidatePath("/ai-agents");
    return { ok: true, data: await getAgentData() };
  } catch {
    return { ok: false, error: "No se pudo eliminar el agente.", errorCode: "DB_ERROR" };
  }
}
