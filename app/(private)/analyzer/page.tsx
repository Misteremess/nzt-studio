// app/(private)/analyzer/page.tsx
// Local Business Analyzer — NZT-80/81
// Full-height workspace: Leaflet map + search + signals/opportunities panel.
// All heavy logic lives in server actions (features/analyzer/actions.ts).

import { AnalyzerView } from "@/features/analyzer/components/analyzer-view";

export default function AnalyzerPage() {
  return <AnalyzerView />;
}
