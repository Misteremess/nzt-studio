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

/** Tarjeta del tablero pipeline — incluye los campos de seguimiento comercial */
export interface PipelineCompany {
  id: string;
  name: string;
  sector: string | null;
  city: string | null;
  status: CompanyStatus;
  lastContactAt: Date | null;
  nextAction: string | null;
  updatedAt: Date;
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
