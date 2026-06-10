"use client";

// features/mvp-factory/components/mvp-html-preview.tsx
// Renders an AI-generated, self-contained HTML landing mockup in a sandboxed
// iframe, with desktop/mobile toggle and copy/download/open actions.

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, Monitor, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  html: string;
  businessName: string;
}

// Fixed "device" size the iframe renders at, then scaled down to fit the
// container — keeps a real 16:9 desktop layout instead of a cramped column.
const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 720;
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 667;

export function MvpHtmlPreview({ html, businessName }: Props) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const deviceWidth = viewport === "desktop" ? DESKTOP_WIDTH : MOBILE_WIDTH;
  const deviceHeight = viewport === "desktop" ? DESKTOP_HEIGHT : MOBILE_HEIGHT;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function recompute() {
      const containerWidth = el!.clientWidth;
      setScale(containerWidth > 0 ? Math.min(1, containerWidth / deviceWidth) : 1);
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [deviceWidth]);

  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function handleCopy() {
    navigator.clipboard
      .writeText(html)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {
        // Clipboard can be denied (e.g. no user gesture). Fail silently.
      });
  }

  function handleDownload() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "mvp"}-mockup.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleOpenInNewTab() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 p-0.5">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors",
              viewport === "desktop"
                ? "bg-cyan-500/15 text-cyan-300"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Vista escritorio"
          >
            <Monitor className="h-3.5 w-3.5" />
            Escritorio
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors",
              viewport === "mobile"
                ? "bg-cyan-500/15 text-cyan-300"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Vista móvil"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Móvil
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-cyan-300 hover:text-cyan-200"
            title="Copiar HTML"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            onClick={handleDownload}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-cyan-300 hover:text-cyan-200"
            title="Descargar .html"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            onClick={handleOpenInNewTab}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-cyan-300 hover:text-cyan-200"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex justify-center overflow-hidden rounded-md border border-border bg-background/60 p-2"
      >
        <div
          style={{ width: deviceWidth * scale, height: deviceHeight * scale }}
          className="overflow-hidden rounded bg-white transition-[width,height] duration-200"
        >
          <iframe
            srcDoc={html}
            sandbox="allow-scripts"
            title={`Mockup MVP — ${businessName}`}
            style={{
              width: deviceWidth,
              height: deviceHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="rounded border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
