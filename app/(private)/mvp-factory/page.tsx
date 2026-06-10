// app/(private)/mvp-factory/page.tsx
// MVP Factory — turns opportunities selected in the Analyzer into MVP specs.

import { listFactoryBusinesses } from "@/features/mvp-factory/lib/spec-store";
import { MvpFactoryView } from "@/features/mvp-factory/components/mvp-factory-view";

export default async function MVPFactoryPage() {
  const businesses = await listFactoryBusinesses();

  return (
    <div className="h-full w-full">
      <MvpFactoryView initialBusinesses={businesses} />
    </div>
  );
}
