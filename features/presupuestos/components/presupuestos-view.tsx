"use client";
// features/presupuestos/components/presupuestos-view.tsx
// Orchestrates the whole Presupuestos module: AI brief → editable budget →
// live PDF preview → download & save. Left column is the editor, right column
// is the sticky paper preview with the download button and saved history.

import { useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  Save,
  FilePlus2,
  Trash2,
  Check,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TAX_RATE,
  DEFAULT_VALIDITY_DAYS,
  SIGNATORY_MAXIMO,
  SIGNATORY_IGNACIO,
} from "@/features/presupuestos/lib/constants";
import { formatEur, computeTotals } from "@/features/presupuestos/lib/calc";
import { BudgetItemsEditor } from "@/features/presupuestos/components/budget-items-editor";
import { BudgetPreview } from "@/features/presupuestos/components/budget-preview";
import { BudgetDownloadButton } from "@/features/presupuestos/components/budget-download-button";
import { IssuerSettingsForm } from "@/features/presupuestos/components/issuer-settings-form";
import {
  generateBudgetDraftAction,
  saveBudgetAction,
  deleteBudgetAction,
} from "@/features/presupuestos/actions";
import type {
  BudgetClient,
  BudgetDocumentData,
  BudgetItem,
  BudgetRecord,
  IssuerSettings,
  Signatories,
} from "@/features/presupuestos/types";

const EMPTY_CLIENT: BudgetClient = { name: "", taxId: "", address: "", email: "", phone: "" };

interface FormState {
  currentId: string | null;
  number: string | null;
  issuedAt: string;
  prompt: string;
  client: BudgetClient;
  title: string;
  intro: string;
  items: BudgetItem[];
  notes: string;
  paymentTerms: string;
  validityDays: number;
  taxRate: number;
  discountRate: number;
  signatories: Signatories;
}

function freshForm(): FormState {
  return {
    currentId: null,
    number: null,
    issuedAt: new Date().toISOString(),
    prompt: "",
    client: { ...EMPTY_CLIENT },
    title: "",
    intro: "",
    items: [],
    notes: "",
    paymentTerms: "",
    validityDays: DEFAULT_VALIDITY_DAYS,
    taxRate: DEFAULT_TAX_RATE,
    discountRate: 0,
    signatories: { maximo: true, ignacio: false },
  };
}

function recordToForm(r: BudgetRecord): FormState {
  return {
    currentId: r.id,
    number: r.number,
    issuedAt: r.createdAt,
    prompt: "",
    client: { ...r.client },
    title: r.title,
    intro: r.intro ?? "",
    items: r.items,
    notes: r.notes ?? "",
    paymentTerms: r.paymentTerms ?? "",
    validityDays: r.validityDays,
    taxRate: r.taxRate,
    discountRate: r.discountRate,
    signatories: r.signatories,
  };
}

export function PresupuestosView({
  initialIssuer,
  initialBudgets,
}: {
  initialIssuer: IssuerSettings;
  initialBudgets: BudgetRecord[];
}) {
  const [issuer, setIssuer] = useState<IssuerSettings>(initialIssuer);
  const [budgets, setBudgets] = useState<BudgetRecord[]>(initialBudgets);
  const [form, setForm] = useState<FormState>(freshForm);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  const docData: BudgetDocumentData = useMemo(
    () => ({
      number: form.number ?? `PRES-${new Date(form.issuedAt).getFullYear()}-BORRADOR`,
      issuedAt: form.issuedAt,
      title: form.title || "Título del presupuesto",
      intro: form.intro,
      issuer,
      client: form.client,
      items: form.items,
      notes: form.notes,
      paymentTerms: form.paymentTerms,
      validityDays: form.validityDays,
      taxRate: form.taxRate,
      discountRate: form.discountRate,
      signatories: form.signatories,
    }),
    [form, issuer]
  );

  const totals = computeTotals(form.items, form.taxRate, form.discountRate);
  const canDownload = form.items.length > 0 && form.client.name.trim() !== "";

  async function handleGenerate() {
    if (form.prompt.trim().length < 4) {
      setError("Describe qué necesitas presupuestar.");
      return;
    }
    setGenerating(true);
    setError(null);
    setNotice(null);
    const res = await generateBudgetDraftAction({
      prompt: form.prompt,
      clientName: form.client.name,
    });
    setGenerating(false);
    if (res.ok) {
      patch({
        title: res.data.title,
        intro: res.data.intro,
        items: res.data.items,
        notes: res.data.notes || form.notes,
        paymentTerms: res.data.paymentTerms || form.paymentTerms,
        validityDays: res.data.validityDays || form.validityDays,
      });
      setNotice("Borrador generado. Revisa y ajusta las partidas antes de descargar.");
    } else {
      setError(res.error);
    }
  }

  async function handleSave() {
    if (!canDownload) {
      setError("Añade el nombre del cliente y al menos una partida antes de guardar.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await saveBudgetAction({
      id: form.currentId ?? undefined,
      title: form.title,
      intro: form.intro,
      client: form.client,
      companyId: null,
      items: form.items,
      notes: form.notes,
      paymentTerms: form.paymentTerms,
      validityDays: form.validityDays,
      taxRate: form.taxRate,
      discountRate: form.discountRate,
      signatories: form.signatories,
    });
    setSaving(false);
    if (res.ok) {
      const saved = res.data;
      patch({ currentId: saved.id, number: saved.number, issuedAt: saved.createdAt });
      setBudgets((prev) => {
        const without = prev.filter((b) => b.id !== saved.id);
        return [saved, ...without];
      });
      setNotice(`Presupuesto guardado como ${saved.number}.`);
    } else {
      setError(res.error);
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteBudgetAction(id);
    if (res.ok) {
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      if (form.currentId === id) setForm(freshForm());
    } else {
      setError(res.error);
    }
  }

  function toggleSignatory(key: keyof Signatories) {
    patch({ signatories: { ...form.signatories, [key]: !form.signatories[key] } });
  }

  return (
    <div className="w-full pb-10">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            Genera presupuestos profesionales de Hyperfocus con IA y descárgalos en PDF.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setForm(freshForm())}>
          <FilePlus2 /> Nuevo presupuesto
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ─── Editor column ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <IssuerSettingsForm issuer={issuer} onSaved={setIssuer} />

          {/* AI brief */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Describe el presupuesto</h2>
            </div>
            <textarea
              value={form.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              rows={3}
              placeholder="Ej.: Web corporativa con tienda online para un restaurante, incluyendo diseño, 8 páginas, pasarela de pago y SEO local básico."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button onClick={handleGenerate} disabled={generating} className="mt-2 w-full" size="sm">
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {generating ? "Generando con IA…" : "Generar con IA"}
            </Button>
          </div>

          {/* Client */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Datos del cliente</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre / empresa *" className="sm:col-span-2">
                <Input
                  value={form.client.name}
                  onChange={(e) => patch({ client: { ...form.client, name: e.target.value } })}
                  placeholder="Restaurante La Plaza S.L."
                />
              </Field>
              <Field label="NIF / CIF">
                <Input
                  value={form.client.taxId}
                  onChange={(e) => patch({ client: { ...form.client, taxId: e.target.value } })}
                  placeholder="B-12345678"
                />
              </Field>
              <Field label="Email">
                <Input
                  value={form.client.email}
                  onChange={(e) => patch({ client: { ...form.client, email: e.target.value } })}
                  placeholder="contacto@cliente.com"
                />
              </Field>
              <Field label="Dirección" className="sm:col-span-2">
                <Input
                  value={form.client.address}
                  onChange={(e) => patch({ client: { ...form.client, address: e.target.value } })}
                  placeholder="Calle, nº, CP, ciudad"
                />
              </Field>
              <Field label="Teléfono">
                <Input
                  value={form.client.phone}
                  onChange={(e) => patch({ client: { ...form.client, phone: e.target.value } })}
                  placeholder="+34 600 000 000"
                />
              </Field>
            </div>
          </div>

          {/* Content */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Contenido</h2>
            <div className="space-y-3">
              <Field label="Título">
                <Input
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Presupuesto — Web corporativa + tienda online"
                />
              </Field>
              <Field label="Introducción">
                <textarea
                  value={form.intro}
                  onChange={(e) => patch({ intro: e.target.value })}
                  rows={2}
                  placeholder="Breve presentación del proyecto para el cliente."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </Field>
              <div>
                <Label className="mb-2 block text-xs text-muted-foreground">Partidas</Label>
                <BudgetItemsEditor items={form.items} onChange={(items) => patch({ items })} />
              </div>
            </div>
          </div>

          {/* Config */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Condiciones e importes</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="IVA (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.taxRate}
                  onChange={(e) => patch({ taxRate: Number(e.target.value) })}
                />
              </Field>
              <Field label="Descuento (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.discountRate}
                  onChange={(e) => patch({ discountRate: Number(e.target.value) })}
                />
              </Field>
              <Field label="Validez (días)">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.validityDays}
                  onChange={(e) => patch({ validityDays: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Condiciones de pago">
                <textarea
                  value={form.paymentTerms}
                  onChange={(e) => patch({ paymentTerms: e.target.value })}
                  rows={2}
                  placeholder="Ej.: 50% al inicio del proyecto y 50% a la entrega."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </Field>
              <Field label="Notas">
                <textarea
                  value={form.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  rows={2}
                  placeholder="Observaciones adicionales (opcional)."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </Field>
            </div>
          </div>

          {/* Signatories */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-1 text-sm font-medium">Firma del presupuesto</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Elige quién firma. Puedes marcar ambos.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SignatoryToggle
                label={SIGNATORY_MAXIMO}
                active={form.signatories.maximo}
                onToggle={() => toggleSignatory("maximo")}
              />
              <SignatoryToggle
                label={SIGNATORY_IGNACIO}
                active={form.signatories.ignacio}
                onToggle={() => toggleSignatory("ignacio")}
              />
            </div>
          </div>

          {/* Saved history */}
          {budgets.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-medium">Guardados</h2>
              <ul className="space-y-1.5">
                {budgets.slice(0, 8).map((b) => (
                  <li
                    key={b.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      form.currentId === b.id ? "bg-primary/10" : "hover:bg-accent"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setForm(recordToForm(b))}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {b.number}
                      </span>
                      <span className="truncate">{b.client.name}</span>
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatEur(
                        computeTotals(b.items, b.taxRate, b.discountRate).total
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* ─── Preview column ────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:h-fit">
          <div className="space-y-3">
            {error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
                <Check className="h-4 w-4" /> {notice}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-foreground">{formatEur(totals.total)}</span>{" "}
                <span className="text-xs">(IVA incl.)</span>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {form.currentId ? "Actualizar" : "Guardar"}
                </Button>
              </div>
            </div>

            <BudgetDownloadButton data={docData} disabled={!canDownload} />
            {!canDownload ? (
              <p className="text-xs text-muted-foreground">
                Añade el nombre del cliente y al menos una partida para descargar el PDF.
              </p>
            ) : null}

            <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted/30 p-3">
              <BudgetPreview data={docData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SignatoryToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border",
          active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
        )}
      >
        {active ? <Check className="h-3 w-3" /> : null}
      </span>
      {label === SIGNATORY_MAXIMO ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
      {label}
    </button>
  );
}
