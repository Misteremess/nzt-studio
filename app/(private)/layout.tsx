import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getAllModuleProviders, getAnthropicModel, getProviderKeyAvailability } from "@/lib/ai/settings";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const [initialProviders, initialAnthropicModel] = await Promise.all([
    getAllModuleProviders(),
    getAnthropicModel(),
  ]);
  const keyAvailability = getProviderKeyAvailability();

  return (
    <AppShell
      initialProviders={initialProviders}
      keyAvailability={keyAvailability}
      initialAnthropicModel={initialAnthropicModel}
    >
      {children}
    </AppShell>
  );
}