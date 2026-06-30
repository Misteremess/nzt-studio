import { TranscriptAnalyzerView } from "@/features/transcript-analyzer/components/transcript-analyzer-view";
import { listTranscriptAnalyses } from "@/features/transcript-analyzer/lib/store";

export default async function TranscriptAnalyzerPage() {
  const analyses = await listTranscriptAnalyses();

  return (
    <div className="mx-auto h-full w-full max-w-[1600px]">
      <TranscriptAnalyzerView initialAnalyses={analyses} />
    </div>
  );
}
