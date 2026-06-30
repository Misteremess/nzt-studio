// features/home/lib/store.ts
// Server-only aggregate read for the Home landing page: today's
// suggestions and a small pipeline stats strip.
import "server-only";

import { prisma } from "@/db/prisma";
import { getDailySuggestions } from "@/features/home/lib/suggestions";
import type { HomeData } from "@/features/home/types";

const activeAnalysis = { archivedAt: null };
const activeOpp = { analysis: activeAnalysis };
const activeSpec = { archivedAt: null, opportunity: activeOpp };
const activeProposal = { archivedAt: null, mvpSpec: activeSpec };

export async function getHomeData(): Promise<HomeData> {
  const [suggestions, companies, opportunities, activeDeliveries, proposals] = await Promise.all([
    getDailySuggestions(),
    prisma.company.count(),
    prisma.aiOpportunity.count({ where: activeOpp }),
    prisma.aiDelivery.count({
      where: { mvpSpec: activeSpec, status: { notIn: ["DELIVERED", "CANCELLED"] } },
    }),
    prisma.aiProposal.count({ where: activeProposal }),
  ]);

  return {
    suggestions,
    stats: { companies, opportunities, activeDeliveries, proposals },
  };
}
