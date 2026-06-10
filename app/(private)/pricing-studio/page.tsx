// app/(private)/pricing-studio/page.tsx
// Pricing Studio — turns MVP specs from the MVP Factory into sellable prices.

import { listPricingBusinesses } from "@/features/pricing-studio/lib/store";
import { PricingStudioView } from "@/features/pricing-studio/components/pricing-studio-view";

export default async function PricingStudioPage() {
  const businesses = await listPricingBusinesses();

  return (
    <div className="mx-auto h-full w-full max-w-5xl">
      <PricingStudioView initialBusinesses={businesses} />
    </div>
  );
}
