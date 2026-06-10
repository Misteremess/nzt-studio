// lib/theme/theme.ts
// Client-safe theme configuration: light/dark mode + accent color presets.
// Preferences live in localStorage and are applied to <html> directly — no DB,
// no server round-trip (these are pure UI prefs for a single-user tool).

export type ThemeMode = "dark" | "light";

export interface AccentPreset {
  id: string;
  label: string;
  /** HSL triple "H S% L%" applied to --primary and --ring. */
  hsl: string;
  /** Swatch color for the picker. */
  swatch: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "indigo", label: "Índigo", hsl: "239 84% 67%", swatch: "hsl(239 84% 67%)" },
  { id: "violet", label: "Violeta", hsl: "263 70% 65%", swatch: "hsl(263 70% 65%)" },
  { id: "blue", label: "Azul", hsl: "217 91% 60%", swatch: "hsl(217 91% 60%)" },
  { id: "cyan", label: "Cian", hsl: "189 94% 43%", swatch: "hsl(189 94% 43%)" },
  { id: "emerald", label: "Esmeralda", hsl: "160 84% 39%", swatch: "hsl(160 84% 39%)" },
  { id: "amber", label: "Ámbar", hsl: "38 92% 50%", swatch: "hsl(38 92% 50%)" },
  { id: "rose", label: "Rosa", hsl: "347 77% 60%", swatch: "hsl(347 77% 60%)" },
];

export const DEFAULT_MODE: ThemeMode = "dark";
export const DEFAULT_ACCENT = "indigo";

export const THEME_STORAGE_KEY = "nzt-theme";
export const ACCENT_STORAGE_KEY = "nzt-accent";

export function accentById(id: string): AccentPreset {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/**
 * Builds a symmetric set of colors around an accent's hue, for use as a
 * looping animated gradient (e.g. GradientText). The array starts and ends
 * with the same color so the animation cycles seamlessly.
 */
export function accentGradientColors(hsl: string): string[] {
  const [h, s, l] = hsl.split(" ").map((v) => parseFloat(v));
  const color = (deltaH: number) => `hsl(${(h + deltaH + 360) % 360} ${s}% ${l}%)`;
  return [color(0), color(35), color(-35), color(35), color(0)];
}

/**
 * Inline <script> body that applies the saved theme before first paint, so
 * there's no flash of the wrong theme. Kept dependency-free and tiny.
 */
export function themeBootstrapScript(): string {
  const accents = JSON.stringify(Object.fromEntries(ACCENTS.map((a) => [a.id, a.hsl])));
  return `(function(){try{
var TK=${JSON.stringify(THEME_STORAGE_KEY)},AK=${JSON.stringify(ACCENT_STORAGE_KEY)};
var m=localStorage.getItem(TK)||${JSON.stringify(DEFAULT_MODE)};
var a=localStorage.getItem(AK)||${JSON.stringify(DEFAULT_ACCENT)};
var root=document.documentElement,accents=${accents};
root.classList.remove('light','dark');
root.classList.add(m==='light'?'light':'dark');
var hsl=accents[a]||accents[${JSON.stringify(DEFAULT_ACCENT)}];
root.style.setProperty('--primary',hsl);
root.style.setProperty('--ring',hsl);
}catch(e){}})();`;
}
