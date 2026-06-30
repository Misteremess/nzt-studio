// features/email-generator/lib/store.ts
// Server-only Prisma helpers for the Email Generator.
// Drafts are standalone records (no FK relations) — referenced
// opportunities/MVPs are stored as a JSON snapshot.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  EmailDraftData,
  EmailGeneratorBusiness,
  EmailReference,
  MeetingType,
} from "@/features/email-generator/types";

// ─── Read drafts ────────────────────────────────────────────────────────────

/** Lists email drafts, most recently updated first. */
export async function listEmailDrafts(includeArchived = false): Promise<EmailDraftData[]> {
  const rows = await prisma.aiEmailDraft.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toEmailDraftData);
}

export async function getEmailDraft(id: string): Promise<EmailDraftData | null> {
  const row = await prisma.aiEmailDraft.findUnique({ where: { id } });
  return row ? toEmailDraftData(row) : null;
}

/**
 * Lists businesses with their detected opportunities (MVP spec id if generated),
 * for the "presentar oportunidades/MVPs" reference picker.
 */
export async function listEmailGeneratorBusinesses(): Promise<EmailGeneratorBusiness[]> {
  const rows = await prisma.businessAnalysis.findMany({
    where: { archivedAt: null, opportunities: { some: {} } },
    orderBy: { updatedAt: "desc" },
    select: {
      placeId: true,
      businessName: true,
      opportunities: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          development: true,
          mvpSpec: { select: { id: true, pitch: true, archivedAt: true } },
        },
      },
    },
  });

  return rows
    .map((r) => ({
      placeId: r.placeId,
      businessName: r.businessName,
      opportunities: r.opportunities.map(
        (o): EmailReference => ({
          opportunityId: o.id,
          mvpSpecId: o.mvpSpec && o.mvpSpec.archivedAt === null ? o.mvpSpec.id : null,
          title: o.title,
          pitch: o.mvpSpec?.pitch ?? o.development,
        })
      ),
    }))
    .filter((b) => b.opportunities.length > 0);
}

// ─── Write ──────────────────────────────────────────────────────────────────

/** Persists a newly generated email draft. */
export async function createEmailDraft(
  input: {
    objective: string;
    recipientName: string;
    recipientRole: string;
    businessName: string;
    senderName: string;
    meetingType: MeetingType;
    meetingNotes: string;
    references: EmailReference[];
  },
  output: { subject: string; body: string },
  model: string,
  raw: unknown
): Promise<EmailDraftData> {
  const row = await prisma.aiEmailDraft.create({
    data: {
      model,
      objective: input.objective,
      recipientName: input.recipientName,
      recipientRole: input.recipientRole,
      businessName: input.businessName,
      senderName: input.senderName,
      meetingType: input.meetingType,
      meetingNotes: input.meetingNotes || null,
      references: input.references as unknown as Prisma.InputJsonValue,
      subject: output.subject,
      body: output.body,
      rawOutput: (raw ?? null) as Prisma.InputJsonValue,
    },
  });
  return toEmailDraftData(row);
}

/** Replaces a draft's generated subject/body (e.g. on regeneration). */
export async function updateEmailDraftOutput(
  id: string,
  output: { subject: string; body: string },
  model: string,
  raw: unknown
): Promise<EmailDraftData> {
  const row = await prisma.aiEmailDraft.update({
    where: { id },
    data: {
      subject: output.subject,
      body: output.body,
      model,
      rawOutput: (raw ?? null) as Prisma.InputJsonValue,
    },
  });
  return toEmailDraftData(row);
}

/** Lets the user hand-edit the generated subject/body. */
export async function editEmailDraft(
  id: string,
  edits: { subject?: string; body?: string }
): Promise<EmailDraftData> {
  const row = await prisma.aiEmailDraft.update({ where: { id }, data: edits });
  return toEmailDraftData(row);
}

/** Archives an email draft. */
export async function archiveEmailDraft(id: string): Promise<void> {
  await prisma.aiEmailDraft.update({ where: { id }, data: { archivedAt: new Date() } });
}

/** Restores an archived email draft. */
export async function restoreEmailDraft(id: string): Promise<void> {
  await prisma.aiEmailDraft.update({ where: { id }, data: { archivedAt: null } });
}

/** Permanently deletes an email draft. */
export async function deleteEmailDraft(id: string): Promise<void> {
  await prisma.aiEmailDraft.delete({ where: { id } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type EmailDraftRow = Prisma.AiEmailDraftGetPayload<object>;

function toEmailDraftData(row: EmailDraftRow): EmailDraftData {
  return {
    id: row.id,
    model: row.model,
    objective: row.objective,
    recipientName: row.recipientName,
    recipientRole: row.recipientRole,
    businessName: row.businessName,
    senderName: row.senderName,
    meetingType: row.meetingType as MeetingType,
    meetingNotes: row.meetingNotes ?? "",
    references: toReferences(row.references),
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReferences(value: Prisma.JsonValue): EmailReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
      const r = v as Record<string, unknown>;
      const opportunityId = typeof r.opportunityId === "string" ? r.opportunityId : "";
      if (!opportunityId) return null;
      return {
        opportunityId,
        mvpSpecId: typeof r.mvpSpecId === "string" ? r.mvpSpecId : null,
        title: typeof r.title === "string" ? r.title : "",
        pitch: typeof r.pitch === "string" ? r.pitch : "",
      };
    })
    .filter((r): r is EmailReference => r !== null);
}
