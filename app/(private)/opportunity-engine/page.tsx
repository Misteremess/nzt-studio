// app/(private)/opportunity-engine/page.tsx
// Opportunity Engine — central prioritized board of every AI-detected
// opportunity across all analyzed businesses.

import { getEngineData } from "@/features/opportunity-engine/lib/store";
import { OpportunityEngineView } from "@/features/opportunity-engine/components/opportunity-engine-view";

export default async function OpportunityEnginePage() {
  const data = await getEngineData();

  return (
    <div className="mx-auto h-full w-full max-w-7xl">
      <OpportunityEngineView initialData={data} />
    </div>
  );
}
