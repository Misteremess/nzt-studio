import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getAllModuleProviders, getProviderKeyAvailability } from "@/lib/ai/settings";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const initialProviders = await getAllModuleProviders();
  const keyAvailability = getProviderKeyAvailability();

  return (
    <AppShell initialProviders={initialProviders} keyAvailability={keyAvailability}>
      {children}
    </AppShell>
  );
}