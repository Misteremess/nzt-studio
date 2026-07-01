// features/presupuestos/schemas.ts
// Zod v4 validation schemas for the Presupuestos module. Used by Server Actions
// to validate untrusted client input before touching the AI or the database.

import { z } from "zod";

export const budgetItemSchema = z.object({
  concept: z.string().trim().min(1, "El concepto es obligatorio").max(300),
  description: z.string().trim().max(1000).default(""),
  quantity: z.number().finite().min(0).max(1_000_000),
  unitPrice: z.number().finite().min(0).max(10_000_000),
});

export const signatoriesSchema = z.object({
  maximo: z.boolean(),
  ignacio: z.boolean(),
});

export const issuerSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  fiscalName: z.string().trim().max(160).default(""),
  taxId: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
  email: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(60).default(""),
  web: z.string().trim().max(160).default(""),
  iban: z.string().trim().max(60).default(""),
});

/** Input for the AI draft generation. */
export const generateDraftSchema = z.object({
  prompt: z.string().trim().min(4, "Describe qué necesitas presupuestar").max(4000),
  clientName: z.string().trim().max(160).default(""),
});

/** Input for persisting a budget. */
export const saveBudgetSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1, "El título es obligatorio").max(300),
  intro: z.string().trim().max(2000).default(""),
  client: z.object({
    name: z.string().trim().min(1, "El nombre del cliente es obligatorio").max(160),
    taxId: z.string().trim().max(40).default(""),
    address: z.string().trim().max(300).default(""),
    email: z.string().trim().max(160).default(""),
    phone: z.string().trim().max(60).default(""),
  }),
  companyId: z.string().trim().min(1).nullable().default(null),
  items: z.array(budgetItemSchema).min(1, "Añade al menos una partida").max(100),
  notes: z.string().trim().max(2000).default(""),
  paymentTerms: z.string().trim().max(1000).default(""),
  validityDays: z.number().int().min(1).max(365).default(30),
  taxRate: z.number().finite().min(0).max(100).default(21),
  discountRate: z.number().finite().min(0).max(100).default(0),
  signatories: signatoriesSchema,
});

export type GenerateDraftInput = z.infer<typeof generateDraftSchema>;
export type SaveBudgetInput = z.infer<typeof saveBudgetSchema>;
export type IssuerSettingsInput = z.infer<typeof issuerSettingsSchema>;
