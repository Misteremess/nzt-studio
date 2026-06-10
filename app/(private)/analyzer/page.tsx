// app/(private)/analyzer/page.tsx
// Analyzer — AI business analysis (Claude + live web research).
// Receives a placeId (from the Rastreador handoff), loads the business context
// and any prior analysis, and renders the interactive AI view.

import {
  getBusinessContext,
  getAnalysisByPlaceId,
  listAnalyses,
} from "@/features/analyzer/lib/analysis-store";
import { AnalyzerAiView } from "@/features/analyzer/components/analyzer-ai-view";
import { AnalyzerLanding } from "@/features/analyzer/components/analyzer-landing";

export default async function AnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{ placeId?: string; list?: string }>;
}) {
  const { placeId, list } = await searchParams;

  // ── No business selected: landing (last-analyzed or listing) ──────────────
  if (!placeId) {
    const analyses = await listAnalyses();
    return (
      <div className="mx-auto h-full w-full max-w-5xl">
        <AnalyzerLanding analyses={analyses} forceList={list === "1"} />
      </div>
    );
  }

  const [ctx, analysis] = await Promise.all([
    getBusinessContext(placeId),
    getAnalysisByPlaceId(placeId),
  ]);

  return (
    <div className="mx-auto h-full w-full max-w-5xl">
      <AnalyzerAiView
        placeId={placeId}
        businessName={ctx?.name ?? null}
        initialAnalysis={analysis}
      />
    </div>
  );
}
