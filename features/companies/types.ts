// features/companies/types.ts
// Tipos específicos del módulo Companies.
// Los tipos de dominio compartidos viven en types/global.ts

export type CompanyStatus = "active" | "inactive" | "prospect";
export type CompanyPriority = "high" | "medium" | "low";

export interface Company {
  id: string;
  name: string;
  sector: string;
  city: string;
  website?: string;
  status: CompanyStatus;
  priority: CompanyPriority;
  createdAt: Date;
  updatedAt: Date;
}