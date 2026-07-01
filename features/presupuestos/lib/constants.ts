// features/presupuestos/lib/constants.ts
// Client-safe constants for the Presupuestos module (no process.env, no Prisma).

import type { IssuerSettings } from "@/features/presupuestos/types";

/** The two people who can sign a Hyperfocus budget. */
export const SIGNATORY_MAXIMO = "Máximo Du Pérez";
export const SIGNATORY_IGNACIO = "Ignacio Sánchez Yuste";

/** Brand accent (matches the cyan Hyperfocus logo). Used in the PDF + preview. */
export const BRAND_CYAN = "#4FD6FF";
export const BRAND_INK = "#0B1220";

/** Default IVA rate applied to new budgets (general Spanish rate). */
export const DEFAULT_TAX_RATE = 21;

/** Default validity window for a budget, in days. */
export const DEFAULT_VALIDITY_DAYS = 30;

/**
 * Fallback issuer identity. Real fiscal data (NIF/CIF, address…) is filled in by
 * the user in the "Datos del emisor" panel and persisted in AppSetting; until
 * then these blanks render as placeholders in the PDF.
 */
export const DEFAULT_ISSUER: IssuerSettings = {
  companyName: "Hyperfocus",
  fiscalName: "",
  taxId: "",
  address: "",
  email: "",
  phone: "",
  web: "hyperfocus.es",
  iban: "",
};

/** AppSetting key under which the issuer identity JSON is stored. */
export const ISSUER_SETTING_KEY = "presupuestos.issuer";

/**
 * The Hyperfocus logo mark as a single SVG path (viewBox 0 0 880 913,
 * fill-rule evenodd). Embedded vectorially in the PDF header so it stays crisp
 * at any size and needs no external asset at render time.
 */
export const HYPERFOCUS_LOGO_VIEWBOX = "0 0 880 913";
export const HYPERFOCUS_LOGO_PATH =
  "M 558 0 L 500 0 L 260 58 L 165 106 L 116 170 L 0 488 L 0 555 L 34 631 L 217 862 L 309 912 L 356 912 L 614 855 L 709 812 L 761 743 L 879 424 L 879 357 L 838 271 L 657 54 Z M 188 191 L 210 205 L 247 255 L 248 281 L 210 397 L 272 478 L 287 479 L 320 393 L 339 372 L 390 422 L 396 444 L 337 631 L 269 799 L 248 793 L 205 730 L 206 702 L 243 602 L 241 579 L 172 505 L 160 515 L 127 605 L 108 614 L 69 572 L 56 542 L 60 511 L 165 222 Z M 817 409 L 818 427 L 794 494 L 771 520 L 568 564 L 552 581 L 550 595 L 560 602 L 696 583 L 702 591 L 698 616 L 663 687 L 518 719 L 494 739 L 473 797 L 456 820 L 370 840 L 359 831 L 473 500 L 498 463 L 790 401 Z";
