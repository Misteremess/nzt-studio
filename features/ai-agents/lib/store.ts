// features/ai-agents/lib/store.ts
// Server-only Prisma CRUD for AI Agents (AiAgent model).
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import {
  AGENT_CHANNELS,
  AGENT_STATUSES,
  type AgentChannel,
  type AgentData,
  type AgentInput,
  type AgentItem,
  type AgentStatus,
} from "@/features/ai-agents/types";

type AgentRow = Prisma.AiAgentGetPayload<object>;

function toItem(row: AgentRow): AgentItem {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel as AgentChannel,
    status: row.status as AgentStatus,
    description: row.description ?? "",
    clientName: row.clientName ?? "",
    phoneNumber: row.phoneNumber ?? "",
    emailAddress: row.emailAddress ?? "",
    elevenLabsAgentId: row.elevenLabsAgentId ?? "",
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getAgentData(): Promise<AgentData> {
  const rows = await prisma.aiAgent.findMany({ orderBy: { updatedAt: "desc" } });
  const items = rows.map(toItem);

  const countsByChannel = Object.fromEntries(AGENT_CHANNELS.map((c) => [c, 0])) as Record<
    AgentChannel,
    number
  >;
  const countsByStatus = Object.fromEntries(AGENT_STATUSES.map((s) => [s, 0])) as Record<
    AgentStatus,
    number
  >;
  for (const it of items) {
    countsByChannel[it.channel] += 1;
    countsByStatus[it.status] += 1;
  }

  return { items, countsByChannel, countsByStatus };
}

function clean(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export async function createAgent(input: AgentInput): Promise<AgentItem> {
  const row = await prisma.aiAgent.create({
    data: {
      name: input.name,
      channel: input.channel,
      status: input.status,
      description: clean(input.description),
      clientName: clean(input.clientName),
      phoneNumber: clean(input.phoneNumber),
      emailAddress: clean(input.emailAddress),
      elevenLabsAgentId: clean(input.elevenLabsAgentId),
      notes: clean(input.notes),
    },
  });
  return toItem(row);
}

export async function updateAgent(id: string, input: AgentInput): Promise<AgentItem> {
  const row = await prisma.aiAgent.update({
    where: { id },
    data: {
      name: input.name,
      channel: input.channel,
      status: input.status,
      description: clean(input.description),
      clientName: clean(input.clientName),
      phoneNumber: clean(input.phoneNumber),
      emailAddress: clean(input.emailAddress),
      elevenLabsAgentId: clean(input.elevenLabsAgentId),
      notes: clean(input.notes),
    },
  });
  return toItem(row);
}

export async function deleteAgent(id: string): Promise<void> {
  await prisma.aiAgent.delete({ where: { id } });
}
