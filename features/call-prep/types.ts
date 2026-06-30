// features/call-prep/types.ts
// Types for the Call Prep Agent module.
// Generates a call/meeting script (agenda, key points, objections, discovery
// questions, next steps) from an already-generated commercial proposal.

export type { MeetingType } from "@/features/email-generator/types";
export { MEETING_TYPES, MEETING_TYPE_META } from "@/features/email-generator/types";

import type { MeetingType } from "@/features/email-generator/types";

/** A possible client objection with a suggested response. */
export interface CallObjection {
  objection: string;
  response: string;
}

/** A persisted call script. */
export interface CallScriptData {
  id: string;
  proposalId: string;
  model: string;
  meetingType: MeetingType;
  agenda: string[];
  keyPoints: string[];
  objections: CallObjection[];
  questions: string[];
  nextSteps: string[];
  createdAt: string;
  updatedAt: string;
}

/** A proposal eligible for a call script (already generated). */
export interface CallPrepCandidate {
  proposalId: string;
  businessName: string;
  proposalTitle: string;
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  investment: string;
  opportunityPitch: string;
  hasScript: boolean;
}

/** Input used to generate a script. */
export interface CallPrepInput {
  proposalId: string;
  businessName: string;
  meetingType: MeetingType;
  context: string;
}

/** Raw output returned by the AI call. */
export interface CallScriptOutput {
  agenda: string[];
  keyPoints: string[];
  objections: CallObjection[];
  questions: string[];
  nextSteps: string[];
}
