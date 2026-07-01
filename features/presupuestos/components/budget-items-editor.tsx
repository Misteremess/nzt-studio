"use client";
// features/presupuestos/components/budget-items-editor.tsx
// Editable table of budget line items (partidas). Fully controlled — the parent
// owns the items array and receives every change.

import { Plus, Trash2, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lineTotal, formatEur } from "@/features/presupuestos/lib/calc";
import type { BudgetItem } from "@/features/presupuestos/types";

const EMPTY_ITEM: BudgetItem = { concept: "", description: "", quantity: 1, unitPrice: 0 };

export function BudgetItemsEditor({
  items,
  onChange,
}: {
  items: BudgetItem[];
  onChange: (items: BudgetItem[]) => void;
}) {
  function update(index: number, patch: Partial<BudgetItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, { ...EMPTY_ITEM }]);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Sin partidas. Genera con IA o añade una manualmente.
        </p>
      ) : (
        items.map((item, i) => (
          <div key={i} className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-start gap-2">
              <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/50" />
              <div className="flex-1 space-y-2">
                <Input
                  value={item.concept}
                  onChange={(e) => update(i, { concept: e.target.value })}
                  placeholder="Concepto (p. ej. Diseño y desarrollo web)"
                  className="font-medium"
                />
                <textarea
                  value={item.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  placeholder="Descripción (opcional)"
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Cantidad</span>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={item.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                      className="w-24"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Precio unit. (€, sin IVA)</span>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={item.unitPrice}
                      onChange={(e) => update(i, { unitPrice: Number(e.target.value) })}
                      className="w-36"
                    />
                  </label>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatEur(lineTotal(item))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar partida"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full">
        <Plus /> Añadir partida
      </Button>
    </div>
  );
}
