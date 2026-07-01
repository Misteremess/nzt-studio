// features/presupuestos/types.ts
// Client-safe types for the Presupuestos (Budgets) module.
// No "server-only", no Prisma imports — the client form and PDF import these.

/** A single line item in a budget. */
export interface BudgetItem {
  /** Short concept / service name, e.g. "Diseño y desarrollo de web corporativa". */
  concept: string;
  /** Optional longer description shown under the concept. */
  description: string;
  /** Units (hours, pages, months…). Defaults to 1. */
  quantity: number;
  /** Price per unit in EUR, before tax. */
  unitPrice: number;
}

/** The two people who can sign a Hyperfocus budget. */
export interface Signatories {
  maximo: boolean;
  ignacio: boolean;
}

/** Issuer (emisor) fiscal identity — persisted in AppSetting, editable in the UI. */
export interface IssuerSettings {
  /** Commercial / brand name shown big in the header. */
  companyName: string;
  /** Legal fiscal name (razón social), if different from the brand. */
  fiscalName: string;
  /** NIF or CIF. */
  taxId: string;
  address: string;
  email: string;
  phone: string;
  web: string;
  /** IBAN for bank transfer (shown in payment terms). */
  iban: string;
}

/** The AI-generated draft of a budget (before the user edits/saves it). */
export interface BudgetDraft {
  title: string;
  intro: string;
  items: BudgetItem[];
  notes: string;
  paymentTerms: string;
  validityDays: number;
}

/** Computed monetary totals for a budget. */
export interface BudgetTotals {
  /** Sum of quantity·unitPrice across items, before discount/tax. */
  subtotal: number;
  /** Discount amount (subtotal · discountRate/100). */
  discount: number;
  /** Taxable base after discount. */
  taxBase: number;
  /** IVA amount (taxBase · taxRate/100). */
  tax: number;
  /** Final total (taxBase + tax). */
  total: number;
}

/** Client (destinatario) data for a budget. */
export interface BudgetClient {
  name: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
}

export type BudgetStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";

/** A fully persisted budget record, as returned to the client. */
export interface BudgetRecord {
  id: string;
  number: string;
  title: string;
  intro: string | null;
  client: BudgetClient;
  companyId: string | null;
  items: BudgetItem[];
  notes: string | null;
  paymentTerms: string | null;
  validityDays: number;
  taxRate: number;
  discountRate: number;
  signatories: Signatories;
  status: BudgetStatus;
  createdAt: string;
  updatedAt: string;
}

/** Everything the PDF/preview needs to render one budget document. */
export interface BudgetDocumentData {
  number: string;
  /** ISO date the budget was issued. */
  issuedAt: string;
  title: string;
  intro: string;
  issuer: IssuerSettings;
  client: BudgetClient;
  items: BudgetItem[];
  notes: string;
  paymentTerms: string;
  validityDays: number;
  taxRate: number;
  discountRate: number;
  signatories: Signatories;
}
