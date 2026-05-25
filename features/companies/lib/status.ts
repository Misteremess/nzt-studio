import type { CompanyStatus } from "@/features/companies/types";

interface StatusConfig {
  label: string;
  badgeClass: string;
}

export const STATUS_CONFIG: Record<CompanyStatus, StatusConfig> = {
  PROSPECT: {
    label: "Prospecto",
    badgeClass: "border-zinc-600 bg-zinc-700/50 text-zinc-300",
  },
  ACTIVE: {
    label: "Activa",
    badgeClass: "border-blue-700/50 bg-blue-900/30 text-blue-300",
  },
  PROPOSAL_SENT: {
    label: "Propuesta enviada",
    badgeClass: "border-amber-700/50 bg-amber-900/30 text-amber-300",
  },
  CLIENT: {
    label: "Cliente",
    badgeClass: "border-emerald-700/50 bg-emerald-900/30 text-emerald-300",
  },
  INACTIVE: {
    label: "Inactiva",
    badgeClass: "border-zinc-700 bg-zinc-800/50 text-zinc-500",
  },
};

export const ALL_STATUSES = Object.keys(STATUS_CONFIG) as CompanyStatus[];

export function getStatusConfig(status: CompanyStatus): StatusConfig {
  return STATUS_CONFIG[status];
}
