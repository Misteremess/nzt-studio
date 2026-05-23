// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility para combinar clases Tailwind (necesario para shadcn/ui)
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Formatters básicos
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amount);
}