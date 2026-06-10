// features/delivery-workspace/types.ts
// Client-safe types for the Delivery Workspace — post-sale tracking of the MVPs
// NZT Studio has decided to build & ship. No AI here: pure delivery tracking on
// top of the spec produced by the MVP Factory.

import type { Complexity } from "@/features/mvp-factory/types";

/** Lifecycle of a delivery. Mirrors the Prisma `DeliveryStatus` enum. */
export type DeliveryStatus =
  | "QUEUED"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DELIVERED"
  | "ON_HOLD"
  | "CANCELLED";

/** A single checklist item within a delivery. */
export interface DeliveryTask {
  id: string;
  title: string;
  done: boolean;
  position: number;
  createdAt: string;
}

/** An active delivery: a tracked MVP build with checklist, links and notes. */
export interface DeliveryItem {
  id: string;
  mvpSpecId: string;
  status: DeliveryStatus;
  repoUrl: string | null;
  deployUrl: string | null;
  notes: string | null;
  startedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Enriched context (read-only).
  opportunityId: string;
  opportunityTitle: string;
  businessName: string;
  placeId: string;
  pitch: string;
  complexity: Complexity | null;
  hasPricing: boolean;
  hasProposal: boolean;
  tasks: DeliveryTask[];
}

/** A spec ready to ship that has no delivery started yet (the inbox). */
export interface AvailableSpec {
  mvpSpecId: string;
  opportunityId: string;
  opportunityTitle: string;
  businessName: string;
  placeId: string;
  pitch: string;
  complexity: Complexity | null;
  hasPricing: boolean;
  hasProposal: boolean;
}

/** Aggregate counters for the board header. */
export interface DeliveryStats {
  available: number;
  active: number;
  inReview: number;
  delivered: number;
  totalTasks: number;
  doneTasks: number;
}

/** Everything the Delivery Workspace view needs in one payload. */
export interface DeliveryBoard {
  deliveries: DeliveryItem[];
  available: AvailableSpec[];
  stats: DeliveryStats;
}
