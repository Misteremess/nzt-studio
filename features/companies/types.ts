import type { CompanyStatus } from "@prisma/client";

export type { CompanyStatus };

export interface CompanyListItem {
  id: string;
  name: string;
  sector: string | null;
  city: string | null;
  website: string | null;
  status: CompanyStatus;
  createdAt: Date;
}

export interface CompanyDetail {
  id: string;
  name: string;
  sector: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  mapsUrl: string | null;
  notes: string | null;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}
