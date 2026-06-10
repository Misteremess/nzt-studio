// features/knowledge-base/types.ts
// Client-safe types for the Knowledge Base — a personal library of reusable
// templates, prompts, guides, references, case studies and snippets.

export type KbType = "TEMPLATE" | "PROMPT" | "GUIDE" | "REFERENCE" | "CASE_STUDY" | "SNIPPET";

export const KB_TYPES: KbType[] = [
  "TEMPLATE",
  "PROMPT",
  "GUIDE",
  "REFERENCE",
  "CASE_STUDY",
  "SNIPPET",
];

export interface KbTypeMeta {
  label: string;
  badge: string; // Tailwind classes for the chip
}

export const KB_TYPE_META: Record<KbType, KbTypeMeta> = {
  TEMPLATE: { label: "Plantilla", badge: "border-indigo-500/30 text-indigo-400" },
  PROMPT: { label: "Prompt", badge: "border-emerald-500/30 text-emerald-400" },
  GUIDE: { label: "Guía", badge: "border-sky-500/30 text-sky-400" },
  REFERENCE: { label: "Referencia", badge: "border-amber-500/30 text-amber-400" },
  CASE_STUDY: { label: "Caso de uso", badge: "border-violet-500/30 text-violet-400" },
  SNIPPET: { label: "Snippet", badge: "border-rose-500/30 text-rose-400" },
};

export interface KbItem {
  id: string;
  type: KbType;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KbData {
  items: KbItem[];
  tags: string[]; // distinct tags across all items, by frequency
  countsByType: Record<KbType, number>;
}

/** Payload for create/update. */
export interface KbInput {
  type: KbType;
  title: string;
  content: string;
  tags: string[];
}
