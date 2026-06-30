"use client";

// components/theme/theme-provider.tsx
// Holds the active theme mode + accent and applies them to <html>, persisting
// to localStorage. The bootstrap script (in the root layout) applies the saved
// values before paint; this provider keeps React state in sync and handles
// runtime changes from the settings modal.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  THEME_STORAGE_KEY,
  accentById,
  type ThemeMode,
} from "@/lib/theme/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: string;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accentId: string) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  // Sync React state with whatever the bootstrap script already applied.
  // Deliberately an effect (not a lazy initializer): consumers like the header
  // render theme-dependent markup during SSR, so state must match the server
  // default at hydration and only then adopt the stored value.
  useEffect(() => {
    const storedMode = localStorage.getItem(THEME_STORAGE_KEY);
    const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration sync with localStorage
    setModeState(storedMode === "light" ? "light" : "dark");
    setAccentState(accentById(storedAccent ?? DEFAULT_ACCENT).id);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setModeState(next);
  }, []);

  const setAccent = useCallback((accentId: string) => {
    const preset = accentById(accentId);
    const root = document.documentElement;
    root.style.setProperty("--primary", preset.hsl);
    root.style.setProperty("--ring", preset.hsl);
    localStorage.setItem(ACCENT_STORAGE_KEY, preset.id);
    setAccentState(preset.id);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
