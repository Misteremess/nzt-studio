"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPageTitle } from "./nav";

export function Topbar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background/60 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      <h1 className="text-sm font-medium tracking-tight text-foreground">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Notificaciones (pronto)</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Menú de usuario"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                IS
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">Ignacio</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              ignaciosanchezyuste@gmail.com
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Configuración</DropdownMenuItem>
            <DropdownMenuItem disabled>
              Cerrar sesión
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Sprint 2
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
