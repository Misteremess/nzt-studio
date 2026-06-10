// app/(private)/market-intelligence/page.tsx
// Market Intelligence — analytics across every analyzed business: sectors,
// reputation, opportunity themes and coverage.

import { getMarketData } from "@/features/market-intelligence/lib/store";
import { MarketIntelligenceView } from "@/features/market-intelligence/components/market-intelligence-view";

export default async function MarketIntelligencePage() {
  const data = await getMarketData();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <MarketIntelligenceView data={data} />
    </div>
  );
}
