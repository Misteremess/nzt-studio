"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALL_STATUSES, STATUS_CONFIG } from "@/features/companies/lib/status";
import type { CompanyFormState } from "@/features/companies/actions";
import type { CompanyStatus } from "@/features/companies/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyFormValues {
  name?: string | null;
  sector?: string | null;
  city?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  mapsUrl?: string | null;
  notes?: string | null;
  status?: CompanyStatus;
}

interface CompanyFormProps {
  defaultValues?: CompanyFormValues;
  action: (state: CompanyFormState, formData: FormData) => Promise<CompanyFormState>;
  submitLabel?: string;
  cancelHref: string;
}

// ─── Shared class constants ───────────────────────────────────────────────────

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none";

const initialState: CompanyFormState = { success: false };

// ─── Field wrapper ────────────────────────────────────────────────────────────

function FormField({
  name,
  label,
  required,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error?.[0] && (
        <p className="text-xs text-destructive">{error[0]}</p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompanyForm({
  defaultValues,
  action,
  submitLabel = "Crear empresa",
  cancelHref,
}: CompanyFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const e = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-6">
      {/* Error global */}
      {!state.success && state.message && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{state.message}</p>
        </div>
      )}

      {/* Información básica */}
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Información básica
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField name="name" label="Nombre" required error={e?.name}>
              <Input
                id="name"
                name="name"
                defaultValue={defaultValues?.name ?? ""}
                placeholder="Panadería García"
                autoComplete="organization"
              />
            </FormField>
          </div>

          <FormField name="sector" label="Sector" error={e?.sector}>
            <Input
              id="sector"
              name="sector"
              defaultValue={defaultValues?.sector ?? ""}
              placeholder="Alimentación"
            />
          </FormField>

          <FormField name="city" label="Ciudad" error={e?.city}>
            <Input
              id="city"
              name="city"
              defaultValue={defaultValues?.city ?? ""}
              placeholder="Madrid"
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField name="status" label="Estado comercial" required error={e?.status}>
              <select
                id="status"
                name="status"
                defaultValue={defaultValues?.status ?? "PROSPECT"}
                className={SELECT_CLASS}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      </div>

      {/* Presencia digital */}
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Presencia digital
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            name="website"
            label="Sitio web"
            hint="URL completa (ej. https://ejemplo.com)"
            error={e?.website}
          >
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={defaultValues?.website ?? ""}
              placeholder="https://ejemplo.com"
            />
          </FormField>

          <FormField
            name="mapsUrl"
            label="Google Maps"
            hint="URL del perfil en Google Maps"
            error={e?.mapsUrl}
          >
            <Input
              id="mapsUrl"
              name="mapsUrl"
              type="url"
              defaultValue={defaultValues?.mapsUrl ?? ""}
              placeholder="https://maps.app.goo.gl/..."
            />
          </FormField>
        </div>
      </div>

      {/* Contacto */}
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Contacto público
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField name="email" label="Email" error={e?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultValues?.email ?? ""}
              placeholder="contacto@empresa.com"
            />
          </FormField>

          <FormField name="phone" label="Teléfono" error={e?.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={defaultValues?.phone ?? ""}
              placeholder="+34 600 000 000"
            />
          </FormField>
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Notas internas
        </p>
        <FormField name="notes" label="Notas" error={e?.notes}>
          <textarea
            id="notes"
            name="notes"
            defaultValue={defaultValues?.notes ?? ""}
            placeholder="Observaciones internas sobre esta empresa..."
            rows={4}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
        <Button asChild variant="ghost" disabled={isPending}>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
