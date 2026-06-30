// app/(private)/ai-agents/page.tsx
// AI Agents — registry of NZT Studio's own AI agents (WhatsApp Business,
// Email, Phone via ElevenLabs).

import { getAgentData } from "@/features/ai-agents/lib/store";
import { AiAgentsView } from "@/features/ai-agents/components/ai-agents-view";

export default async function AiAgentsPage() {
  const data = await getAgentData();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <AiAgentsView initialData={data} />
    </div>
  );
}
