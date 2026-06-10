// features/dashboard/types.ts
// Client-safe types for the Dashboard analytics overview.

export interface DashboardKpis {
  analyses: number;
  opportunities: number;
  selected: number;
  specs: number;
  proposals: number;
  activeDeliveries: number;
  delivered: number;
  potentialRevenue: number; // sum of one-off setup prices (EUR)
  recurringRevenue: number; // sum of monthly prices (EUR)
}

export interface FunnelStageData {
  label: string;
  value: number;
}

export interface SliceData {
  label: string;
  value: number;
  color?: string;
}

export interface SeriesPointData {
  label: string;
  value: number;
}

export interface BarDatumData {
  label: string;
  value: number;
  hint?: string;
}

export type RecentKind = "analysis" | "opportunity" | "spec" | "proposal" | "delivery";

export interface RecentItem {
  id: string;
  kind: RecentKind;
  title: string;
  businessName: string;
  at: string; // ISO
}

export interface DashboardData {
  kpis: DashboardKpis;
  funnel: FunnelStageData[];
  quadrants: SliceData[];
  activity: SeriesPointData[];
  topBusinesses: BarDatumData[];
  deliveryStatus: SliceData[];
  recent: RecentItem[];
  hasData: boolean;
}
