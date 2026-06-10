import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  CompanyStatus,
  CompanyListItem,
  PipelineCompany,
} from "@/features/companies/types";

export const PAGE_SIZE = 12;

export interface CompaniesFilters {
  q?: string;
  status?: CompanyStatus;
  sector?: string;
  city?: string;
}

export interface FilterOptions {
  sectors: string[];
  cities: string[];
}

export interface CompaniesResult {
  companies: CompanyListItem[];
  total: number;
  page: number;
  totalPages: number;
}

function buildWhere(filters: CompaniesFilters): Prisma.CompanyWhereInput {
  const { q, status, sector, city } = filters;
  return {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sector: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { website: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
    ...(sector && { sector }),
    ...(city && { city }),
  };
}

export async function getCompanies(
  filters: CompaniesFilters,
  rawPage: number
): Promise<CompaniesResult> {
  const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
  const where = buildWhere(filters);

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        sector: true,
        city: true,
        website: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return { companies, total, page: safePage, totalPages };
}

export interface CompanyStats {
  total: number;
  byStatus: Record<CompanyStatus, number>;
}

/** Pipeline overview: total companies and a count per status. */
export async function getCompanyStats(): Promise<CompanyStats> {
  const [total, grouped] = await Promise.all([
    prisma.company.count(),
    prisma.company.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = {
    PROSPECT: 0,
    ACTIVE: 0,
    PROPOSAL_SENT: 0,
    CLIENT: 0,
    INACTIVE: 0,
  } as Record<CompanyStatus, number>;

  for (const g of grouped) {
    byStatus[g.status as CompanyStatus] = g._count._all;
  }

  return { total, byStatus };
}

/**
 * All companies for the pipeline board, most recently touched first.
 * Single-user tool — no pagination needed at this scale.
 */
export async function getPipelineCompanies(): Promise<PipelineCompany[]> {
  return prisma.company.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      sector: true,
      city: true,
      status: true,
      lastContactAt: true,
      nextAction: true,
      updatedAt: true,
    },
  });
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const [sectorRows, cityRows] = await Promise.all([
    prisma.company.findMany({
      where: { sector: { not: null } },
      select: { sector: true },
      distinct: ["sector"],
    }),
    prisma.company.findMany({
      where: { city: { not: null } },
      select: { city: true },
      distinct: ["city"],
    }),
  ]);

  return {
    sectors: sectorRows.map((r) => r.sector as string).sort(),
    cities: cityRows.map((r) => r.city as string).sort(),
  };
}
