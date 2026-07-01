// features/presupuestos/lib/issuer.ts
// Server-only persistence for the budget issuer (emisor) fiscal identity.
// Stored as a JSON blob in the AppSetting key-value table under one key.
import "server-only";

import { prisma } from "@/db/prisma";
import { DEFAULT_ISSUER, ISSUER_SETTING_KEY } from "@/features/presupuestos/lib/constants";
import type { IssuerSettings } from "@/features/presupuestos/types";

/** Reads the issuer identity, merging stored values over the defaults. */
export async function getIssuerSettings(): Promise<IssuerSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: ISSUER_SETTING_KEY } });
  if (!row) return { ...DEFAULT_ISSUER };
  try {
    const parsed = JSON.parse(row.value) as Partial<IssuerSettings>;
    return { ...DEFAULT_ISSUER, ...parsed };
  } catch {
    return { ...DEFAULT_ISSUER };
  }
}

/** Persists the issuer identity as a JSON blob. */
export async function saveIssuerSettings(settings: IssuerSettings): Promise<void> {
  const value = JSON.stringify(settings);
  await prisma.appSetting.upsert({
    where: { key: ISSUER_SETTING_KEY },
    create: { key: ISSUER_SETTING_KEY, value },
    update: { value },
  });
}
