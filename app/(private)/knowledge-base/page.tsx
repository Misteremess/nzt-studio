// app/(private)/knowledge-base/page.tsx
// Knowledge Base — a searchable library of reusable templates, prompts, guides,
// references, case studies and snippets.

import { getKnowledgeData } from "@/features/knowledge-base/lib/store";
import { KnowledgeBaseView } from "@/features/knowledge-base/components/knowledge-base-view";

export default async function KnowledgeBasePage() {
  const data = await getKnowledgeData();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <KnowledgeBaseView initialData={data} />
    </div>
  );
}
