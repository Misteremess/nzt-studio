import { CallPrepView } from "@/features/call-prep/components/call-prep-view";
import { listCallPrepCandidates, listCallScripts } from "@/features/call-prep/lib/store";

export default async function CallPrepPage() {
  const [scripts, candidates] = await Promise.all([listCallScripts(), listCallPrepCandidates()]);

  return (
    <div className="mx-auto h-full w-full max-w-[1600px]">
      <CallPrepView initialScripts={scripts} candidates={candidates} />
    </div>
  );
}
