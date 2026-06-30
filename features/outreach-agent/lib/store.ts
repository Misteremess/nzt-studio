// features/outreach-agent/lib/store.ts
// Server-only Prisma helpers for the Outreach Agent.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  OutreachCandidate,
  OutreachInput,
  OutreachSequenceData,
  OutreachStep,
  OutreachStepStatus,
} from "@/features/outreach-agent/types";

/**
 * Lists businesses that already have at least one opportunity with a generated
 * proposal — the minimum context needed for a meaningful follow-up sequence.
 */
export async function listOutreachCandidates(): Promise<OutreachCandidate[]> {
  const rows = await prisma.businessAnalysis.findMany({
    where: { archivedAt: null, opportunities: { some: { mvpSpec: { proposal: { isNot: null } } } } },
    orderBy: { updatedAt: "desc" },
    select: {
      placeId: true,
      businessName: true,
      summary: true,
      opportunities: {
        where: { mvpSpec: { proposal: { isNot: null } } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          title: true,
          mvpSpec: {
            select: {
              pitch: true,
              proposal: { select: { title: true, investment: true, archivedAt: true } },
            },
          },
        },
      },
    },
  });

  return rows
    .filter((r) => r.opportunities[0]?.mvpSpec?.proposal && r.opportunities[0].mvpSpec.proposal.archivedAt === null)
    .map((r) => {
      const opp = r.opportunities[0];
      const proposal = opp.mvpSpec!.proposal!;
      return {
        placeId: r.placeId,
        businessName: r.businessName,
        summary: r.summary,
        opportunityTitle: opp.title,
        pitch: opp.mvpSpec!.pitch,
        proposalTitle: proposal.title,
        investment: proposal.investment,
      };
    });
}

export async function listOutreachSequences(includeArchived = false): Promise<OutreachSequenceData[]> {
  const rows = await prisma.aiOutreachSequence.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  if (rows.length === 0) return [];

  const placeIds = [...new Set(rows.map((r) => r.placeId))];
  const placeCaches = await prisma.placeCache.findMany({
    where: { placeId: { in: placeIds } },
    select: { placeId: true, company: { select: { email: true } } },
  });
  const emailByPlaceId = new Map(placeCaches.map((p) => [p.placeId, p.company?.email ?? null]));

  return rows.map((row) => toOutreachSequenceData(row, emailByPlaceId.get(row.placeId) ?? null));
}

export async function getOutreachSequence(id: string): Promise<OutreachSequenceData | null> {
  const row = await prisma.aiOutreachSequence.findUnique({ where: { id } });
  if (!row) return null;
  const placeCache = await prisma.placeCache.findUnique({
    where: { placeId: row.placeId },
    select: { company: { select: { email: true } } },
  });
  return toOutreachSequenceData(row, placeCache?.company?.email ?? null);
}

export async function createOutreachSequence(
  input: OutreachInput,
  steps: OutreachStep[],
  model: string,
  raw: unknown
): Promise<OutreachSequenceData> {
  const initialSteps: OutreachStep[] = steps.map((s) => ({ ...s, status: "pending", sentAt: null }));
  const row = await prisma.aiOutreachSequence.create({
    data: {
      model,
      placeId: input.placeId,
      businessName: input.businessName,
      context: input.context,
      steps: initialSteps as unknown as Prisma.InputJsonValue,
      rawOutput: (raw ?? null) as Prisma.InputJsonValue,
    },
  });
  const placeCache = await prisma.placeCache.findUnique({
    where: { placeId: input.placeId },
    select: { company: { select: { email: true } } },
  });
  return toOutreachSequenceData(row, placeCache?.company?.email ?? null);
}

/** Updates a single step's status / edited content within a sequence's JSON array. */
export async function updateOutreachStep(
  sequenceId: string,
  stepNumber: number,
  updates: { subject?: string; body?: string; status?: OutreachStepStatus; sentAt?: string | null }
): Promise<OutreachSequenceData | null> {
  const row = await prisma.aiOutreachSequence.findUnique({ where: { id: sequenceId } });
  if (!row) return null;

  const steps = toSteps(row.steps).map((s) =>
    s.stepNumber === stepNumber ? { ...s, ...updates } : s
  );

  const updated = await prisma.aiOutreachSequence.update({
    where: { id: sequenceId },
    data: { steps: steps as unknown as Prisma.InputJsonValue },
  });
  const placeCache = await prisma.placeCache.findUnique({
    where: { placeId: row.placeId },
    select: { company: { select: { email: true } } },
  });
  return toOutreachSequenceData(updated, placeCache?.company?.email ?? null);
}

/** Replaces a single step's generated content (angle/subject/body) after a regeneration. */
export async function replaceOutreachStep(
  sequenceId: string,
  stepNumber: number,
  replacement: { angle: string; subject: string; body: string }
): Promise<OutreachSequenceData | null> {
  const row = await prisma.aiOutreachSequence.findUnique({ where: { id: sequenceId } });
  if (!row) return null;

  const steps = toSteps(row.steps).map((s) =>
    s.stepNumber === stepNumber
      ? { ...s, ...replacement, status: "pending" as const, sentAt: null }
      : s
  );

  const updated = await prisma.aiOutreachSequence.update({
    where: { id: sequenceId },
    data: { steps: steps as unknown as Prisma.InputJsonValue },
  });
  const placeCache = await prisma.placeCache.findUnique({
    where: { placeId: row.placeId },
    select: { company: { select: { email: true } } },
  });
  return toOutreachSequenceData(updated, placeCache?.company?.email ?? null);
}

export async function archiveOutreachSequence(id: string): Promise<void> {
  await prisma.aiOutreachSequence.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function restoreOutreachSequence(id: string): Promise<void> {
  await prisma.aiOutreachSequence.update({ where: { id }, data: { archivedAt: null } });
}

export async function deleteOutreachSequence(id: string): Promise<void> {
  await prisma.aiOutreachSequence.delete({ where: { id } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type OutreachSequenceRow = Prisma.AiOutreachSequenceGetPayload<object>;

function toOutreachSequenceData(row: OutreachSequenceRow, recipientEmail: string | null): OutreachSequenceData {
  return {
    id: row.id,
    model: row.model,
    placeId: row.placeId,
    businessName: row.businessName,
    context: row.context,
    steps: toSteps(row.steps),
    recipientEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const STEP_STATUSES: OutreachStepStatus[] = ["pending", "sent", "replied", "no_response"];

function toSteps(value: Prisma.JsonValue): OutreachStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
      const r = v as Record<string, unknown>;
      const status = STEP_STATUSES.includes(r.status as OutreachStepStatus)
        ? (r.status as OutreachStepStatus)
        : "pending";
      return {
        stepNumber: typeof r.stepNumber === "number" ? r.stepNumber : 0,
        delayDays: typeof r.delayDays === "number" ? r.delayDays : 0,
        angle: typeof r.angle === "string" ? r.angle : "",
        subject: typeof r.subject === "string" ? r.subject : "",
        body: typeof r.body === "string" ? r.body : "",
        status,
        sentAt: typeof r.sentAt === "string" ? r.sentAt : null,
      };
    })
    .filter((s): s is OutreachStep => s !== null);
}
