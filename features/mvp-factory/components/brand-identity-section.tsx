"use client";

// features/mvp-factory/components/brand-identity-section.tsx
// Per-business "Identidad visual" panel for the MVP Factory inbox.
//
// Lets the studio detect a business's REAL brand identity (colors, fonts,
// logo) from its website, from an uploaded logo, or configure it manually —
// so the AI HTML mockup stops inventing generic palettes.

import { useRef, useState, useTransition } from "react";
import { Globe, Upload, Pencil, Check, X, Loader2, Palette, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  extractBrandIdentityFromWebsiteAction,
  extractBrandIdentityFromImageAction,
  saveBrandIdentityAction,
} from "@/features/mvp-factory/actions";
import type { BrandColor, BrandIdentityData } from "@/features/mvp-factory/types";

interface Props {
  placeId: string;
  websiteUri: string | null;
  brandIdentity: BrandIdentityData | null;
}

const COLOR_ROLES: { role: string; label: string }[] = [
  { role: "primary", label: "Primario" },
  { role: "secondary", label: "Secundario" },
  { role: "accent", label: "Acento" },
  { role: "background", label: "Fondo" },
  { role: "surface", label: "Superficie / cards" },
  { role: "text", label: "Texto" },
];

const SOURCE_LABEL: Record<BrandIdentityData["source"], string> = {
  website: "Detectada de la web",
  logo: "Detectada del logo",
  manual: "Manual",
};

const ALLOWED_TYPES = "image/png,image/jpeg,image/webp,image/gif";

export function BrandIdentitySection({ placeId, websiteUri, brandIdentity }: Props) {
  const [identity, setIdentity] = useState<BrandIdentityData | null>(brandIdentity);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDetecting, startDetect] = useTransition();
  const [isUploadingLogo, startUploadLogo] = useTransition();
  const [isUploadingReference, startUploadReference] = useTransition();
  const [isSaving, startSave] = useTransition();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [colorsByRole, setColorsByRole] = useState<Record<string, string>>(() =>
    initialColors(brandIdentity)
  );
  const [fontHeading, setFontHeading] = useState(brandIdentity?.fontHeading ?? "");
  const [fontBody, setFontBody] = useState(brandIdentity?.fontBody ?? "");
  const [styleNotes, setStyleNotes] = useState(brandIdentity?.styleNotes ?? "");

  function syncFormFromIdentity(data: BrandIdentityData) {
    setColorsByRole(initialColors(data));
    setFontHeading(data.fontHeading ?? "");
    setFontBody(data.fontBody ?? "");
    setStyleNotes(data.styleNotes ?? "");
  }

  function handleDetectFromWebsite() {
    setError(null);
    startDetect(async () => {
      const result = await extractBrandIdentityFromWebsiteAction(placeId);
      if (result.ok) {
        setIdentity(result.data);
        syncFormFromIdentity(result.data);
        setShowForm(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleUploadLogo(file: File) {
    setError(null);
    startUploadLogo(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await extractBrandIdentityFromImageAction(placeId, fd, "logo");
      if (result.ok) {
        setIdentity(result.data);
        syncFormFromIdentity(result.data);
        setShowForm(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleUploadReference(file: File) {
    setError(null);
    startUploadReference(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await extractBrandIdentityFromImageAction(placeId, fd, "reference");
      if (result.ok) {
        setIdentity(result.data);
        syncFormFromIdentity(result.data);
        setShowForm(true);
      } else {
        setError(result.error);
      }
    });
  }

  function handleSave() {
    setError(null);
    const colors: BrandColor[] = COLOR_ROLES.filter(({ role }) => isHex(colorsByRole[role])).map(
      ({ role, label }) => ({ role, hex: colorsByRole[role], label })
    );

    startSave(async () => {
      const result = await saveBrandIdentityAction(placeId, {
        source: identity?.source ?? "manual",
        sourceUrl: identity?.sourceUrl ?? null,
        colors,
        fontHeading: fontHeading.trim() || null,
        fontBody: fontBody.trim() || null,
        styleNotes: styleNotes.trim() || null,
        logoImage: identity?.logoImage ?? null,
        logoImageMime: identity?.logoImageMime ?? null,
        referenceImage: identity?.referenceImage ?? null,
        referenceImageMime: identity?.referenceImageMime ?? null,
      });
      if (result.ok) {
        setIdentity(result.data);
        setShowForm(false);
      } else {
        setError(result.error);
      }
    });
  }

  const isBusy = isDetecting || isUploadingLogo || isUploadingReference || isSaving;
  const logoSrc = identity?.logoImage
    ? `data:${identity.logoImageMime};base64,${identity.logoImage}`
    : null;

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-medium uppercase tracking-wider text-violet-300 inline-flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5" />
          Identidad visual
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {identity && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {SOURCE_LABEL[identity.source]}
            </Badge>
          )}

          {websiteUri && (
            <Button
              type="button"
              onClick={handleDetectFromWebsite}
              disabled={isBusy}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-violet-300 hover:text-violet-200"
            >
              {isDetecting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Globe className="h-3.5 w-3.5 mr-1.5" />
              )}
              {identity ? "Re-detectar de la web" : "Detectar desde la web"}
            </Button>
          )}

          <Button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={isBusy}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-violet-300 hover:text-violet-200"
          >
            {isUploadingLogo ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            Subir logo
          </Button>
          <input
            ref={logoInputRef}
            type="file"
            accept={ALLOWED_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadLogo(file);
              e.target.value = "";
            }}
          />

          <Button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            disabled={isBusy}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-violet-300 hover:text-violet-200"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {identity ? "Editar" : "Configurar manualmente"}
          </Button>
        </div>
      </div>

      {/* Summary */}
      {identity && !showForm && (
        <div className="flex items-center gap-3 flex-wrap">
          {identity.colors.length > 0 && (
            <div className="flex items-center gap-1">
              {identity.colors.map((c) => (
                <div
                  key={c.role}
                  title={`${c.role}: ${c.hex}`}
                  className="h-5 w-5 rounded border border-border/60"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
          {(identity.fontHeading || identity.fontBody) && (
            <p className="text-xs text-muted-foreground">
              {identity.fontHeading ?? "—"} / {identity.fontBody ?? "—"}
            </p>
          )}
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Logo" className="h-6 w-auto object-contain" />
          )}
        </div>
      )}

      {!identity && !showForm && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sin identidad visual definida. Los mockups web usarán una paleta deducida automáticamente.
          Detecta la identidad real desde la web del negocio, sube su logo, o configúrala a mano.
        </p>
      )}

      {/* Edit form */}
      {showForm && (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COLOR_ROLES.map(({ role, label }) => (
              <div key={role} className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{label}</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={isHex(colorsByRole[role]) ? colorsByRole[role] : "#ffffff"}
                    onChange={(e) => setColorsByRole((c) => ({ ...c, [role]: e.target.value }))}
                    className="h-8 w-8 shrink-0 rounded border border-input bg-transparent p-0.5"
                  />
                  <Input
                    value={colorsByRole[role] ?? ""}
                    onChange={(e) => setColorsByRole((c) => ({ ...c, [role]: e.target.value }))}
                    placeholder="#RRGGBB"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Tipografía de títulos</label>
              <Input
                value={fontHeading}
                onChange={(e) => setFontHeading(e.target.value)}
                placeholder="Ej. Poppins"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Tipografía de cuerpo</label>
              <Input
                value={fontBody}
                onChange={(e) => setFontBody(e.target.value)}
                placeholder="Ej. Inter"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">
              Notas de marca (tono, personalidad, qué evitar...)
            </label>
            <textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Ej. artesanal y cálido, evitar tonos fríos..."
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button
              type="button"
              onClick={() => referenceInputRef.current?.click()}
              disabled={isBusy}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              {isUploadingReference ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              )}
              Subir imagen de referencia / brief
            </Button>
            <input
              ref={referenceInputRef}
              type="file"
              accept={ALLOWED_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadReference(file);
                e.target.value = "";
              }}
            />

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isBusy}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isBusy}
                size="sm"
                className="h-7 px-2 text-xs"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function initialColors(identity: BrandIdentityData | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const c of identity?.colors ?? []) {
    result[c.role] = c.hex;
  }
  return result;
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function isHex(value: string | undefined): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}
