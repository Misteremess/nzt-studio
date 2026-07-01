"use client";
// features/presupuestos/components/issuer-settings-form.tsx
// Collapsible "Datos del emisor" panel. Persists the Hyperfocus fiscal identity
// (NIF/CIF, address, contact, IBAN) so every budget carries the correct data.

import { useState } from "react";
import { Building2, ChevronDown, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveIssuerSettingsAction } from "@/features/presupuestos/actions";
import type { IssuerSettings } from "@/features/presupuestos/types";

const FIELDS: { key: keyof IssuerSettings; label: string; placeholder: string; wide?: boolean }[] = [
  { key: "companyName", label: "Nombre comercial", placeholder: "Hyperfocus" },
  { key: "fiscalName", label: "Razón social (si difiere)", placeholder: "Hyperfocus S.L." },
  { key: "taxId", label: "NIF / CIF", placeholder: "B-12345678" },
  { key: "iban", label: "IBAN", placeholder: "ES00 0000 0000 0000 0000 0000" },
  { key: "address", label: "Dirección", placeholder: "Calle, nº, CP, ciudad", wide: true },
  { key: "email", label: "Email", placeholder: "hola@hyperfocus.es" },
  { key: "phone", label: "Teléfono", placeholder: "+34 600 000 000" },
  { key: "web", label: "Web", placeholder: "hyperfocus.es" },
];

export function IssuerSettingsForm({
  issuer,
  onSaved,
}: {
  issuer: IssuerSettings;
  onSaved: (next: IssuerSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IssuerSettings>(issuer);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomplete = !form.taxId.trim() || !form.address.trim();

  function set(key: keyof IssuerSettings, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await saveIssuerSettingsAction(form);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      onSaved(res.data);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Datos del emisor (Hyperfocus)</span>
        {incomplete ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500">
            Faltan datos fiscales
          </span>
        ) : null}
        <ChevronDown
          className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                <Label htmlFor={`issuer-${f.key}`} className="mb-1 block text-xs text-muted-foreground">
                  {f.label}
                </Label>
                <Input
                  id={`issuer-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
              {saved ? "Guardado" : "Guardar datos del emisor"}
            </Button>
            <p className="text-xs text-muted-foreground">Se aplican a todos los presupuestos.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
