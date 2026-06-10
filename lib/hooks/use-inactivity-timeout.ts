"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

/**
 * Tracks user inactivity. After `warningMs` of inactivity, `warning` becomes
 * true. After `timeoutMs`, the session is signed out automatically.
 */
export function useInactivityTimeout(
  timeoutMs = 30 * 60 * 1000,
  warningMs = 28 * 60 * 1000
) {
  const [warning, setWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimers();
    setWarning(false);
    warningRef.current = setTimeout(() => setWarning(true), warningMs);
    timeoutRef.current = setTimeout(
      () => signOut({ callbackUrl: "/login" }),
      timeoutMs
    );
  }, [clearTimers, timeoutMs, warningMs]);

  useEffect(() => {
    resetTimer();
    EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      clearTimers();
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer, clearTimers]);

  return { warning, resetTimer };
}
