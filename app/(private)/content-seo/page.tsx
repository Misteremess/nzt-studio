import { ContentSeoView } from "@/features/content-seo/components/content-seo-view";
import { listContentPlanCandidates, listContentPlans, listSeoAuditCandidates, listSeoAudits } from "@/features/content-seo/lib/store";

interface Props {
  searchParams: Promise<{ placeId?: string }>;
}

export default async function ContentSeoPage({ searchParams }: Props) {
  const { placeId } = await searchParams;
  const [plans, candidates, seoAuditCandidates, seoAudits] = await Promise.all([
    listContentPlans(),
    listContentPlanCandidates(),
    listSeoAuditCandidates(),
    listSeoAudits(),
  ]);

  return (
    <div className="mx-auto h-full w-full max-w-[1600px]">
      <ContentSeoView
        initialPlans={plans}
        candidates={candidates}
        initialPlaceId={placeId}
        seoAuditCandidates={seoAuditCandidates}
        initialSeoAudits={seoAudits}
      />
    </div>
  );
}
