// features/delivery-workspace/lib/store.ts
// Server-only Prisma reads & writes for the Delivery Workspace. Tracks the
// post-sale build of each MVP: a 1:1 AiDelivery per AiMvpSpec, created on demand
// when the user "starts" a delivery, plus its checklist (AiDeliveryTask).
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type { Complexity } from "@/features/mvp-factory/types";
import type {
  AvailableSpec,
  DeliveryBoard,
  DeliveryItem,
  DeliveryStats,
  DeliveryStatus,
  DeliveryTask,
} from "@/features/delivery-workspace/types";

// ─── Includes / payload types ─────────────────────────────────────────────────

const deliveryInclude = {
  tasks: { orderBy: { position: "asc" } },
  mvpSpec: {
    select: {
      id: true,
      pitch: true,
      complexity: true,
      opportunityId: true,
      pricing: { select: { id: true } },
      proposal: { select: { id: true } },
      opportunity: {
        select: { title: true, analysis: { select: { businessName: true, placeId: true } } },
      },
    },
  },
} satisfies Prisma.AiDeliveryInclude;

type DeliveryRow = Prisma.AiDeliveryGetPayload<{ include: typeof deliveryInclude }>;

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toTask(row: DeliveryRow["tasks"][number]): DeliveryTask {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDeliveryItem(row: DeliveryRow): DeliveryItem {
  const spec = row.mvpSpec;
  return {
    id: row.id,
    mvpSpecId: row.mvpSpecId,
    status: row.status as DeliveryStatus,
    repoUrl: row.repoUrl,
    deployUrl: row.deployUrl,
    notes: row.notes,
    startedAt: row.startedAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    opportunityId: spec.opportunityId,
    opportunityTitle: spec.opportunity.title,
    businessName: spec.opportunity.analysis.businessName,
    placeId: spec.opportunity.analysis.placeId,
    pitch: spec.pitch,
    complexity: (spec.complexity as Complexity | null) ?? null,
    hasPricing: spec.pricing != null,
    hasProposal: spec.proposal != null,
    tasks: row.tasks.map(toTask),
  };
}

// ─── Read the board ───────────────────────────────────────────────────────────

/** Loads active deliveries + specs available to start, with aggregate stats. */
export async function getDeliveryBoard(): Promise<DeliveryBoard> {
  const [deliveryRows, availableRows] = await Promise.all([
    prisma.aiDelivery.findMany({ orderBy: { updatedAt: "desc" }, include: deliveryInclude }),
    prisma.aiMvpSpec.findMany({
      where: { delivery: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        pitch: true,
        complexity: true,
        opportunityId: true,
        pricing: { select: { id: true } },
        proposal: { select: { id: true } },
        opportunity: {
          select: { title: true, analysis: { select: { businessName: true, placeId: true } } },
        },
      },
    }),
  ]);

  const deliveries = deliveryRows.map(toDeliveryItem);

  const available: AvailableSpec[] = availableRows.map((s) => ({
    mvpSpecId: s.id,
    opportunityId: s.opportunityId,
    opportunityTitle: s.opportunity.title,
    businessName: s.opportunity.analysis.businessName,
    placeId: s.opportunity.analysis.placeId,
    pitch: s.pitch,
    complexity: (s.complexity as Complexity | null) ?? null,
    hasPricing: s.pricing != null,
    hasProposal: s.proposal != null,
  }));

  const stats: DeliveryStats = {
    available: available.length,
    active: deliveries.filter((d) => d.status === "IN_PROGRESS").length,
    inReview: deliveries.filter((d) => d.status === "IN_REVIEW").length,
    delivered: deliveries.filter((d) => d.status === "DELIVERED").length,
    totalTasks: deliveries.reduce((n, d) => n + d.tasks.length, 0),
    doneTasks: deliveries.reduce((n, d) => n + d.tasks.filter((t) => t.done).length, 0),
  };

  return { deliveries, available, stats };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/** Creates a delivery for a spec (idempotent: returns existing if present). */
export async function startDelivery(mvpSpecId: string): Promise<void> {
  await prisma.aiDelivery.upsert({
    where: { mvpSpecId },
    create: { mvpSpecId, status: "IN_PROGRESS", startedAt: new Date() },
    update: {},
  });
}

/** Updates a delivery's status, stamping startedAt/deliveredAt as appropriate. */
export async function setDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus
): Promise<void> {
  const current = await prisma.aiDelivery.findUnique({
    where: { id: deliveryId },
    select: { startedAt: true, deliveredAt: true },
  });
  if (!current) return;

  const data: Prisma.AiDeliveryUpdateInput = { status };
  if (status === "IN_PROGRESS" && !current.startedAt) data.startedAt = new Date();
  if (status === "DELIVERED") data.deliveredAt = new Date();
  if (status !== "DELIVERED" && current.deliveredAt) data.deliveredAt = null;

  await prisma.aiDelivery.update({ where: { id: deliveryId }, data });
}

/** Updates editable metadata (repo/deploy URLs, free-text notes). */
export async function updateDeliveryMeta(
  deliveryId: string,
  meta: { repoUrl?: string | null; deployUrl?: string | null; notes?: string | null }
): Promise<void> {
  await prisma.aiDelivery.update({ where: { id: deliveryId }, data: meta });
}

/** Appends a checklist task to a delivery, at the end of the list. */
export async function addDeliveryTask(deliveryId: string, title: string): Promise<void> {
  const last = await prisma.aiDeliveryTask.findFirst({
    where: { deliveryId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await prisma.aiDeliveryTask.create({
    data: { deliveryId, title, position: (last?.position ?? -1) + 1 },
  });
}

/** Toggles (or sets) a checklist task's done state. */
export async function setDeliveryTaskDone(taskId: string, done: boolean): Promise<void> {
  await prisma.aiDeliveryTask.update({ where: { id: taskId }, data: { done } });
}

/** Removes a checklist task. */
export async function deleteDeliveryTask(taskId: string): Promise<void> {
  await prisma.aiDeliveryTask.delete({ where: { id: taskId } });
}

/** Deletes a delivery (and its tasks), returning its spec to the "available to start" pool. */
export async function deleteDelivery(deliveryId: string): Promise<void> {
  await prisma.aiDelivery.delete({ where: { id: deliveryId } });
}
