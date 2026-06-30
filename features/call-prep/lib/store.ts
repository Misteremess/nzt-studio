// features/call-prep/lib/store.ts
// Server-only Prisma helpers for the Call Prep Agent.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type { CallObjection, CallPrepCandidate, CallScriptData, CallScriptOutput, MeetingType } from "@/features/call-prep/types";

/** Lists generated proposals, with their call-prep context and whether a script already exists. */
export async function listCallPrepCandidates(): Promise<CallPrepCandidate[]> {
  const rows = await prisma.aiProposal.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      executiveSummary: true,
      problemStatement: true,
      proposedSolution: true,
      investment: true,
      callScript: { select: { id: true } },
      mvpSpec: {
        select: {
          pitch: true,
          opportunity: { select: { analysis: { select: { businessName: true } } } },
        },
      },
    },
  });

  return rows.map((r) => ({
    proposalId: r.id,
    businessName: r.mvpSpec.opportunity.analysis.businessName,
    proposalTitle: r.title,
    executiveSummary: r.executiveSummary,
    problemStatement: r.problemStatement,
    proposedSolution: r.proposedSolution,
    investment: r.investment,
    opportunityPitch: r.mvpSpec.pitch,
    hasScript: r.callScript !== null,
  }));
}

export async function listCallScripts(includeArchived = false): Promise<CallScriptData[]> {
  const rows = await prisma.aiCallScript.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toCallScriptData);
}

export async function getCallScriptByProposal(proposalId: string): Promise<CallScriptData | null> {
  const row = await prisma.aiCallScript.findUnique({ where: { proposalId } });
  return row ? toCallScriptData(row) : null;
}

/** Creates or replaces the call script for a proposal (1:1 relation). */
export async function upsertCallScript(
  input: { proposalId: string; meetingType: MeetingType },
  output: CallScriptOutput,
  model: string,
  raw: unknown
): Promise<CallScriptData> {
  const data = {
    model,
    meetingType: input.meetingType,
    agenda: output.agenda as unknown as Prisma.InputJsonValue,
    keyPoints: output.keyPoints as unknown as Prisma.InputJsonValue,
    objections: output.objections as unknown as Prisma.InputJsonValue,
    questions: output.questions as unknown as Prisma.InputJsonValue,
    nextSteps: output.nextSteps as unknown as Prisma.InputJsonValue,
    rawOutput: (raw ?? null) as Prisma.InputJsonValue,
    archivedAt: null,
  };
  const row = await prisma.aiCallScript.upsert({
    where: { proposalId: input.proposalId },
    create: { proposalId: input.proposalId, ...data },
    update: data,
  });
  return toCallScriptData(row);
}

export async function archiveCallScript(id: string): Promise<void> {
  await prisma.aiCallScript.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function restoreCallScript(id: string): Promise<void> {
  await prisma.aiCallScript.update({ where: { id }, data: { archivedAt: null } });
}

export async function deleteCallScript(id: string): Promise<void> {
  await prisma.aiCallScript.delete({ where: { id } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type CallScriptRow = Prisma.AiCallScriptGetPayload<object>;

function toCallScriptData(row: CallScriptRow): CallScriptData {
  return {
    id: row.id,
    proposalId: row.proposalId,
    model: row.model,
    meetingType: row.meetingType as MeetingType,
    agenda: toStringArray(row.agenda),
    keyPoints: toStringArray(row.keyPoints),
    objections: toObjections(row.objections),
    questions: toStringArray(row.questions),
    nextSteps: toStringArray(row.nextSteps),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toObjections(value: Prisma.JsonValue): CallObjection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
      const r = v as Record<string, unknown>;
      const objection = typeof r.objection === "string" ? r.objection : "";
      const response = typeof r.response === "string" ? r.response : "";
      if (!objection && !response) return null;
      return { objection, response };
    })
    .filter((o): o is CallObjection => o !== null);
}
