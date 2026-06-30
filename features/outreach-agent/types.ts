// features/outreach-agent/types.ts
// Types for the Outreach Agent module.
// Generates a multi-step follow-up sequence (different angle per step) for a
// business that already has an AI-generated opportunity + proposal.

/** Tracking status of a single follow-up email. */
export type OutreachStepStatus = "pending" | "sent" | "replied" | "no_response";

/** A single step (email) in a follow-up sequence. */
export interface OutreachStep {
  stepNumber: number;
  delayDays: number;
  angle: string;
  subject: string;
  body: string;
  status: OutreachStepStatus;
  sentAt: string | null;
}

/** A persisted outreach sequence. */
export interface OutreachSequenceData {
  id: string;
  model: string;
  placeId: string;
  businessName: string;
  context: string;
  steps: OutreachStep[];
  recipientEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A business eligible for an outreach sequence (has analysis + proposal). */
export interface OutreachCandidate {
  placeId: string;
  businessName: string;
  summary: string;
  opportunityTitle: string;
  pitch: string;
  proposalTitle: string;
  investment: string;
}

/** Input used to generate a sequence. */
export interface OutreachInput {
  placeId: string;
  businessName: string;
  context: string;
}

/** Raw steps returned by the AI call. */
export interface OutreachOutput {
  steps: OutreachStep[];
}
