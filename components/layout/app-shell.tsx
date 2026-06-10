import { Sidebar } from "@/components/layout/sidebar";
import { PrivateHeader } from "@/components/layout/private-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SettingsProvider } from "@/components/settings/settings-modal";
import { InactivityGuard } from "@/components/layout/inactivity-guard";
import type { AiModuleId, AiProvider } from "@/lib/ai/types";

interface AppShellProps {
  children: React.ReactNode;
  initialProviders: Record<AiModuleId, AiProvider>;
  keyAvailability: Record<AiProvider, boolean>;
}

export function AppShell({ children, initialProviders, keyAvailability }: AppShellProps) {
  return (
    <ThemeProvider>
      <SettingsProvider initialProviders={initialProviders} keyAvailability={keyAvailability}>
        <InactivityGuard />
        <div className="flex h-screen overflow-hidden bg-background print:h-auto print:overflow-visible print:bg-white">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:overflow-visible">
            <PrivateHeader />
            <main className="flex-1 min-h-0 overflow-auto p-6 print:overflow-visible print:p-0">
              {children}
            </main>
          </div>
        </div>
      </SettingsProvider>
    </ThemeProvider>
  );
}
