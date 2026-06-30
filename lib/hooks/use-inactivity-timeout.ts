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
 * Throttle for activity events: rearming two timers on every mousemove pixel
 * is wasted work — once per second is more than enough resolution for a
 * 30-minute timeout.
 */
const ACTIVITY_THROTTLE_MS = 1000;

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
  const lastActivityRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  // Arms the timers without touching React state — safe to call from effects.
  const schedule = useCallback(() => {
    clearTimers();
    warningRef.current = setTimeout(() => setWarning(true), warningMs);
    timeoutRef.current = setTimeout(
      () => signOut({ callbackUrl: "/login" }),
      timeoutMs
    );
  }, [clearTimers, timeoutMs, warningMs]);

  // Explicit reset (e.g. the "Mantener sesión" button).
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarning(false);
    schedule();
  }, [schedule]);

  useEffect(() => {
    schedule();
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      setWarning((w) => (w ? false : w));
      schedule();
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      clearTimers();
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [schedule, clearTimers]);

  return { warning, resetTimer };
}
