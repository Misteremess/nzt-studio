// app/(private)/layout.tsx
// Este layout envolverá todas las rutas privadas.
// Aquí irá el Sidebar y autenticación más adelante (NZT-20).

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — se implementa en NZT-16 */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800">
        <div className="p-4">
          <span className="text-sm font-semibold text-zinc-400">
            NZT Studio
          </span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-zinc-950 overflow-auto">
        {children}
      </main>
    </div>
  );
}