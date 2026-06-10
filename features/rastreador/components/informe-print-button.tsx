"use client";

// features/rastreador/components/informe-print-button.tsx
// Botón de imprimir/guardar PDF del informe. El único trozo client-side
// del informe — el resto se renderiza en servidor.

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InformePrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4 mr-2" />
      Imprimir / Guardar PDF
    </Button>
  );
}
