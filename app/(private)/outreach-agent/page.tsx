// app/(private)/outreach-agent/page.tsx
// Outreach Agent — generates multi-step follow-up sequences with AI.

import { listOutreachCandidates, listOutreachSequences } from "@/features/outreach-agent/lib/store";
import { OutreachAgentView } from "@/features/outreach-agent/components/outreach-agent-view";

export default async function OutreachAgentPage() {
  const [sequences, candidates] = await Promise.all([
    listOutreachSequences(),
    listOutreachCandidates(),
  ]);

  return (
    <div className="mx-auto h-full w-full max-w-[1600px]">
      <OutreachAgentView initialSequences={sequences} candidates={candidates} />
    </div>
  );
}
