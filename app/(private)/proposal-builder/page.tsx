// app/(private)/proposal-builder/page.tsx
// Proposal Builder — turns MVP specs (and their pricing) into client-ready
// commercial proposals.

import { listProposalBusinesses } from "@/features/proposal-builder/lib/store";
import { ProposalBuilderView } from "@/features/proposal-builder/components/proposal-builder-view";

export default async function ProposalBuilderPage() {
  const businesses = await listProposalBusinesses();

  return (
    <div className="mx-auto h-full w-full max-w-5xl">
      <ProposalBuilderView initialBusinesses={businesses} />
    </div>
  );
}
