import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type { CompanyStatus, CompanyListItem } from "@/features/companies/types";

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
