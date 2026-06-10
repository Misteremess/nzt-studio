// features/pricing-studio/lib/markdown.ts
// Pure, client-safe rendering of pricing to Markdown for export/copy.

import type { PricingData } from "@/features/pricing-studio/types";

function money(amount: number, currency: string): string {
  const symbol = currency === "EUR" ? "€" : currency;
  return currency === "EUR" ? `${amount} ${symbol}` : `${amount} ${symbol}`;
}

function billingLabel(billing: string): string {
  if (billing === "monthly") return "/mes";
  return " (pago único)";
}

export function pricingToMarkdown(
  businessName: string,
  opportunityTitle: string,
  pricing: PricingData
): string {
  const lines: string[] = [
    `# Propuesta de precio: ${opportunityTitle}`,
    `**Negocio:** ${businessName}`,
    "",
    "## Resumen",
    `- **Construcción (pago único):** ${money(pricing.setupPrice, pricing.currency)}`,
  ];

  if (pricing.monthlyPrice != null) {
    lines.push(`- **Mantenimiento mensual:** ${money(pricing.monthlyPrice, pricing.currency)}/mes`);
  }
  lines.push("");

  if (pricing.tiers.length > 0) {
    lines.push("## Planes");
    pricing.tiers.forEach((t) => {
      const recommended = pricing.recommendedTier === t.name ? " ⭐ (recomendado)" : "";
      lines.push(
        `### ${t.name}${recommended}`,
        `**${money(t.price, pricing.currency)}${billingLabel(t.billing)}**`,
        ""
      );
      if (t.description) lines.push(t.description, "");
      if (t.features.length > 0) {
        lines.push(...t.features.map((f) => `- ${f}`), "");
      }
    });
  }

  if (pricing.saasModel) {
    const s = pricing.saasModel;
    lines.push("## Alternativa: suscripción mensual (SaaS)");
    lines.push(`- **Cuota mensual:** ${money(s.monthlyPrice, pricing.currency)}/mes`);
    if (s.annualPrice != null) {
      lines.push(`- **Plan anual:** ${money(s.annualPrice, pricing.currency)}/año`);
    }
    if (s.setupFee != null) {
      lines.push(`- **Cuota de alta:** ${money(s.setupFee, pricing.currency)}`);
    }
    if (s.minimumTermMonths != null) {
      lines.push(`- **Permanencia mínima:** ${s.minimumTermMonths} meses`);
    }
    if (s.breakEvenMonths != null) {
      lines.push(`- **Equivale al pago único en:** ${s.breakEvenMonths} meses`);
    }
    if (s.includedServices.length > 0) {
      lines.push("", "**Incluye:**", ...s.includedServices.map((f) => `- ${f}`));
    }
    if (s.rationale) lines.push("", s.rationale);
    lines.push("");
  }

  if (pricing.paymentTerms) {
    lines.push("## Condiciones de pago", pricing.paymentTerms, "");
  }
  if (pricing.rationale) {
    lines.push("## Por qué este precio", pricing.rationale, "");
  }
  if (pricing.assumptions.length > 0) {
    lines.push("## Supuestos", ...pricing.assumptions.map((a) => `- ${a}`), "");
  }

  lines.push(`_Generado por ${pricing.model} · NZT Studio Pricing Studio_`);

  return lines.join("\n");
}
