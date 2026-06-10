// features/knowledge-base/lib/store.ts
// Server-only Prisma CRUD for the Knowledge Base (KnowledgeItem model).
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { KB_TYPES, type KbData, type KbInput, type KbItem, type KbType } from "@/features/knowledge-base/types";

type KbRow = Prisma.KnowledgeItemGetPayload<object>;

function toItem(row: KbRow): KbItem {
  return {
    id: row.id,
    type: row.type as KbType,
    title: row.title,
    content: row.content,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getKnowledgeData(): Promise<KbData> {
  const rows = await prisma.knowledgeItem.findMany({ orderBy: { updatedAt: "desc" } });
  const items = rows.map(toItem);

  // Distinct tags by frequency.
  const freq = new Map<string, number>();
  for (const it of items) for (const t of it.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
  const tags = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);

  const countsByType = Object.fromEntries(KB_TYPES.map((t) => [t, 0])) as Record<KbType, number>;
  for (const it of items) countsByType[it.type] += 1;

  return { items, tags, countsByType };
}

export async function createKnowledgeItem(input: KbInput): Promise<KbItem> {
  const row = await prisma.knowledgeItem.create({
    data: {
      type: input.type,
      title: input.title,
      content: input.content,
      tags: input.tags,
    },
  });
  return toItem(row);
}

export async function updateKnowledgeItem(id: string, input: KbInput): Promise<KbItem> {
  const row = await prisma.knowledgeItem.update({
    where: { id },
    data: {
      type: input.type,
      title: input.title,
      content: input.content,
      tags: input.tags,
    },
  });
  return toItem(row);
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  await prisma.knowledgeItem.delete({ where: { id } });
}
