// features/mvp-factory/lib/markdown.ts
// Pure, client-safe rendering of an MVP spec to Markdown for export/copy.

import type { Complexity, MvpSpecData } from "@/features/mvp-factory/types";

const COMPLEXITY_LABEL: Record<Complexity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function specToMarkdown(
  businessName: string,
  opportunityTitle: string,
  spec: MvpSpecData
): string {
  const lines: string[] = [
    `# MVP: ${opportunityTitle}`,
    `**Negocio:** ${businessName}`,
    "",
    `> ${spec.pitch}`,
    "",
    "## Problema",
    spec.problem,
    "",
    "## Solución",
    spec.solution,
    "",
    `## Usuario objetivo`,
    spec.targetUser,
    "",
  ];

  if (spec.coreFeatures.length > 0) {
    lines.push("## Features del MVP", ...spec.coreFeatures.map((f) => `- ${f}`), "");
  }
  if (spec.futureFeatures.length > 0) {
    lines.push("## Mejoras posteriores", ...spec.futureFeatures.map((f) => `- ${f}`), "");
  }
  if (spec.techStack.length > 0) {
    lines.push("## Stack tecnológico", ...spec.techStack.map((t) => `- ${t}`), "");
  }
  if (spec.phases.length > 0) {
    lines.push("## Roadmap");
    spec.phases.forEach((p, i) => {
      lines.push(`### Fase ${i + 1}: ${p.title}`, p.description, "");
    });
  }

  lines.push("## Estimación", `- **Tiempo:** ${spec.timeline}`);
  if (spec.complexity) {
    lines.push(`- **Complejidad:** ${COMPLEXITY_LABEL[spec.complexity]}`);
  }
  lines.push("", `_Generado por ${spec.model} · NZT Studio MVP Factory_`);

  return lines.join("\n");
}

/**
 * Builds a professional, business-adapted prompt the user can paste into Claude
 * to actually build the MVP. Deterministic and client-safe — no AI call needed.
 */
export function buildClaudePrompt(
  businessName: string,
  opportunityTitle: string,
  spec: MvpSpecData
): string {
  const lines: string[] = [
    "Actúa como un ingeniero de producto senior y desarrollador full-stack.",
    `Quiero que construyas un MVP funcional y profesional para "${businessName}".`,
    "",
    "## Contexto del negocio",
    `Negocio: ${businessName}`,
    `Oportunidad a resolver: ${opportunityTitle}`,
    "",
    "## Problema",
    spec.problem,
    "",
    "## Solución propuesta",
    spec.solution,
    "",
    "## Usuario objetivo",
    spec.targetUser,
    "",
    "## Propuesta de valor",
    spec.pitch,
    "",
  ];

  if (spec.coreFeatures.length > 0) {
    lines.push(
      "## Requisitos funcionales del MVP (alcance obligatorio)",
      "Implementa estas funcionalidades, ninguna más:",
      ...spec.coreFeatures.map((f) => `- ${f}`),
      ""
    );
  }

  if (spec.futureFeatures.length > 0) {
    lines.push(
      "## Fuera de alcance (no implementar en el MVP)",
      "Deja estas mejoras para fases posteriores; no las construyas ahora:",
      ...spec.futureFeatures.map((f) => `- ${f}`),
      ""
    );
  }

  if (spec.techStack.length > 0) {
    lines.push(
      "## Stack tecnológico",
      `Usa este stack: ${spec.techStack.join(", ")}.`,
      ""
    );
  }

  if (spec.phases.length > 0) {
    lines.push("## Plan de desarrollo por fases");
    spec.phases.forEach((p, i) => {
      lines.push(`${i + 1}. **${p.title}** — ${p.description}`);
    });
    lines.push("");
  }

  lines.push(
    "## Requisitos de calidad",
    "- Código limpio, tipado y listo para producción.",
    "- Maneja estados de carga, vacío y error en la UI.",
    "- Explica las decisiones de arquitectura antes de escribir código.",
    "- Entrega los archivos completos, no fragmentos sueltos.",
    `- Estimación de referencia: ${spec.timeline}.`,
    "",
    "Empieza proponiendo la arquitectura y la estructura de archivos, y luego implementa la Fase 1."
  );

  return lines.join("\n");
}

/**
 * Builds a prompt tailored for Lovable (the AI full-stack app builder, which
 * generates React + Tailwind + Supabase apps from a single conversational
 * brief). Deterministic and client-safe — no AI call needed.
 */
export function buildLovablePrompt(
  businessName: string,
  opportunityTitle: string,
  spec: MvpSpecData
): string {
  const features =
    spec.coreFeatures.length > 0
      ? spec.coreFeatures.map((f) => `- ${f}`).join("\n")
      : "- (define las pantallas principales del MVP)";

  const futureBlock =
    spec.futureFeatures.length > 0
      ? `\nNo incluyas todavía estas funcionalidades (son para más adelante):\n${spec.futureFeatures
          .map((f) => `- ${f}`)
          .join("\n")}\n`
      : "";

  return [
    `Construye una aplicación web para "${businessName}".`,
    "",
    `Idea: ${spec.pitch}`,
    "",
    `Es un MVP que resuelve: ${opportunityTitle}. ${spec.solution}`,
    `Está pensada para: ${spec.targetUser}.`,
    "",
    "Funcionalidades que SÍ debe tener el MVP:",
    features,
    futureBlock,
    "Diseño y experiencia:",
    "- Estética moderna, limpia y profesional, totalmente responsive (móvil primero).",
    "- Inventa una identidad de marca coherente (paleta, tipografía y un logotipo tipográfico) adecuada para este negocio.",
    "- Interfaz en español, con textos realistas (nada de lorem ipsum).",
    "- Cuida los estados de carga, vacío y error.",
    "",
    "Tecnología:",
    "- React + Tailwind. Usa Supabase para datos y autenticación si hace falta persistencia.",
    "- Componentes reutilizables y código mantenible.",
    "",
    "Empieza por la página principal (landing) con la propuesta de valor y la navegación, y después construye las pantallas funcionales una a una.",
  ].join("\n");
}
