import {
  Boxes,
  Building2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Library,
  Lightbulb,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Si `true`, el item se renderiza visible pero como ruta aún no implementada.
   * Sirve para que el shell muestre todo el mapa del producto en Sprint 1
   * aunque las páginas no existan todavía.
   */
  upcoming?: boolean;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Empresas", href: "/empresas", icon: Building2, upcoming: true },
      { label: "Análisis", href: "/analisis", icon: Search, upcoming: true },
      { label: "Oportunidades", href: "/oportunidades", icon: Lightbulb, upcoming: true },
      { label: "MVPs", href: "/mvps", icon: Boxes, upcoming: true },
      { label: "Propuestas", href: "/propuestas", icon: FileText, upcoming: true },
      { label: "Proyectos", href: "/proyectos", icon: FolderKanban, upcoming: true },
    ],
  },
  {
    label: "Recursos",
    items: [
      { label: "Conocimiento", href: "/conocimiento", icon: Library, upcoming: true },
      { label: "Configuración", href: "/config", icon: Settings, upcoming: true },
    ],
  },
];

const FLAT_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export function getPageTitle(pathname: string): string {
  const match = FLAT_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "NZT Studio";
}
