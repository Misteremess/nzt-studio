// features/opportunity-engine/types.ts
export type OpportunityStatus = "detected" | "validated" | "proposed" | "closed";
export type OpportunityDifficulty = "low" | "medium" | "high";

export interface Opportunity {
  id: string;
  companyId: string;
  title: string;
  problem: string;
  solution: string;
  impact: string;
  difficulty: OpportunityDifficulty;
  estimatedPrice?: number;
  status: OpportunityStatus;
  createdAt: Date;
}