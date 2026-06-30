// features/email-generator/types.ts
// Types for the Email Generator module.
// Drafts personalized commercial emails: presenting one or several
// opportunities/MVPs (without attaching the MVP itself), proposing a meeting
// (call / Teams / in person), or fully standalone (e.g. selling NZT's own AI
// agent services) — driven by a free-text "objective".

export type MeetingType = "NONE" | "CALL" | "VIDEO_CALL" | "IN_PERSON";

export const MEETING_TYPES: MeetingType[] = ["NONE", "CALL", "VIDEO_CALL", "IN_PERSON"];

export const MEETING_TYPE_META: Record<MeetingType, string> = {
  NONE: "Sin propuesta de reunión",
  CALL: "Llamada telefónica",
  VIDEO_CALL: "Videollamada (Teams)",
  IN_PERSON: "Reunión presencial",
};

/** Snapshot of an opportunity/MVP referenced (presented) inside the email. */
export interface EmailReference {
  opportunityId: string;
  mvpSpecId: string | null;
  title: string;
  pitch: string;
}

/** A persisted email draft. */
export interface EmailDraftData {
  id: string;
  model: string;
  objective: string;
  recipientName: string;
  recipientRole: string;
  businessName: string;
  senderName: string;
  meetingType: MeetingType;
  meetingNotes: string;
  references: EmailReference[];
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Raw subject + body returned by the AI call. */
export interface EmailOutput {
  subject: string;
  body: string;
}

/** Form input used to generate (or regenerate) an email draft. */
export interface EmailDraftInput {
  objective: string;
  recipientName: string;
  recipientRole: string;
  businessName: string;
  senderName: string;
  meetingType: MeetingType;
  meetingNotes: string;
  references: EmailReference[];
}

/** A business with its candidate opportunities/MVPs, for the reference picker. */
export interface EmailGeneratorBusiness {
  placeId: string;
  businessName: string;
  opportunities: EmailReference[];
}
