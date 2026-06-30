// features/transcript-analyzer/types.ts
// Types for the Transcript Analyzer module.
// The user pastes a call/meeting transcript and the AI extracts a summary,
// requirements, objections, action items and overall sentiment.

export type Sentiment = "positive" | "neutral" | "negative";

/** A possible client objection with a suggested response (empty string if none). */
export interface TranscriptObjection {
  objection: string;
  response: string;
}

/** A persisted transcript analysis. */
export interface TranscriptAnalysisData {
  id: string;
  model: string;
  businessName: string | null;
  transcript: string;
  summary: string;
  requirements: string[];
  objections: TranscriptObjection[];
  actionItems: string[];
  sentiment: Sentiment;
  createdAt: string;
  updatedAt: string;
}

/** Input used to analyze a transcript. */
export interface TranscriptAnalyzerInput {
  businessName?: string;
  transcript: string;
}

/** Raw output returned by the AI call. */
export interface TranscriptAnalysisOutput {
  summary: string;
  requirements: string[];
  objections: TranscriptObjection[];
  actionItems: string[];
  sentiment: Sentiment;
}
