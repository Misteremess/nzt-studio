// app/(private)/rastreador/page.tsx
// Rastreador — Local Business Tracker (Google Places).
// Full-height workspace: Leaflet map + search + signals/opportunities panel.
// All heavy logic lives in server actions (features/rastreador/actions.ts).

import { AnalyzerViewClient } from "@/features/rastreador/components/analyzer-view-client";

export default function RastreadorPage() {
  return <AnalyzerViewClient />;
}
