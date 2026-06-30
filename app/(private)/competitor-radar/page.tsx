import { CompetitorRadarView } from "@/features/competitor-radar/components/competitor-radar-view";
import { listCompetitorRadarCandidates, listCompetitorRadarReports } from "@/features/competitor-radar/lib/store";

interface Props {
  searchParams: Promise<{ placeId?: string }>;
}

export default async function CompetitorRadarPage({ searchParams }: Props) {
  const { placeId } = await searchParams;
  const [reports, candidates] = await Promise.all([listCompetitorRadarReports(), listCompetitorRadarCandidates()]);

  return (
    <div className="mx-auto h-full w-full max-w-[1600px]">
      <CompetitorRadarView initialReports={reports} candidates={candidates} initialPlaceId={placeId} />
    </div>
  );
}
