"use server";
// features/home/actions.ts
// Server Actions for the Home landing page.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { getOrRefreshNews } from "@/features/home/lib/news";
import { mapAiError } from "@/lib/ai/action-errors";
import type { HomeNewsData } from "@/features/home/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

/** Forces a fresh daily news search, replacing today's cache. */
export async function refreshNewsAction(): Promise<ActionResult<HomeNewsData>> {
  try {
    const news = await getOrRefreshNews(true);
    if (news.error) {
      return { ok: false, error: news.error, errorCode: "API_ERROR" };
    }
    revalidatePath("/home");
    return { ok: true, data: news };
  } catch (err) {
    return mapAiError(err, "Home", "Error inesperado al actualizar las noticias.");
  }
}
