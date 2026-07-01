import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session;
}
