// features/proposal-builder/lib/markdown.ts
// Pure, client-safe rendering of a proposal to Markdown for export/copy.

import type { ProposalData } from "@/features/proposal-builder/types";

export function proposalToMarkdown(
  businessName: string,
  proposal: ProposalData
): string {
  const lines: string[] = [
    `# ${proposal.title || "Propuesta de proyecto"}`,
    `**Para:** ${businessName}`,
    "",
  ];

  if (proposal.executiveSummary) {
    lines.push("## Resumen ejecutivo", proposal.executiveSummary, "");
  }
  if (proposal.problemStatement) {
    lines.push("## El reto", proposal.problemStatement, "");
  }
  if (proposal.proposedSolution) {
    lines.push("## Solución propuesta", proposal.proposedSolution, "");
  }
  if (proposal.scope.length > 0) {
    lines.push("## Alcance del proyecto", ...proposal.scope.map((s) => `- ${s}`), "");
  }
  if (proposal.outOfScope.length > 0) {
    lines.push("## Fuera de alcance", ...proposal.outOfScope.map((s) => `- ${s}`), "");
  }
  if (proposal.deliverables.length > 0) {
    lines.push("## Entregables", ...proposal.deliverables.map((d) => `- ${d}`), "");
  }
  if (proposal.phases.length > 0) {
    lines.push("## Plan de trabajo");
    proposal.phases.forEach((p, i) => {
      lines.push(`### Fase ${i + 1}: ${p.title}`, p.description, "");
    });
  }
  if (proposal.investment) {
    lines.push("## Inversión", proposal.investment, "");
  }
  if (proposal.terms.length > 0) {
    lines.push("## Condiciones", ...proposal.terms.map((t) => `- ${t}`), "");
  }
  if (proposal.nextSteps.length > 0) {
    lines.push("## Próximos pasos", ...proposal.nextSteps.map((n) => `- ${n}`), "");
  }
  if (proposal.callToAction) {
    lines.push("---", "", proposal.callToAction, "");
  }

  lines.push(`_Generado por ${proposal.model} · NZT Studio Proposal Builder_`);

  return lines.join("\n");
}
