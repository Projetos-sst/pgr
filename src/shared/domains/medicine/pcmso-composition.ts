import { createHash } from "node:crypto";

import { z } from "zod";

import { CLINICAL_EXAM_NOTE } from "./exam-rules";
import { addDays, addMonths } from "./nr7-schedule-rules";
import type { PcmsoReadinessItem } from "./pcmso-readiness";
import { criteriaCoverage, type CurrentCriterion } from "./interpretation-criteria";
import { getProcedure } from "./procedure-catalog";

/**
 * Composição do PCMSO (NOB-151) a partir do que já foi validado e aprovado: empresa, coordenador
 * (NOB-144), riscos validados de fonte vigente com possíveis agravos (NR-7 7.5.4 a), exames e
 * periodicidades do plano **aprovado pelo coordenador** (NOB-150; 7.5.4 b) e ciclo de planejamento
 * de 12 meses a partir da data-base (MED-14), distinto da revisão (7.5.1) e do relatório anual (7.6.2). Sai sempre como **prévia**: sem assinatura verificável não há
 * documento oficial (MED-12). Seções que o sistema ainda não tem entram como pendentes, nunca
 * com texto inventado. O leiaute final depende do modelo do Dr. Alcides (MED-08), não enviado.
 */
// v2 (NOB-153): critérios de interpretação; v3 (NOB-154): referência ao relatório analítico.
export const PCMSO_CONTENT_SCHEMA_VERSION = 3;
export const PCMSO_PREVIEW_NOTICE =
  "PRÉVIA — documento sem assinatura do médico responsável e sem validade legal (MED-12).";

export const pcmsoGenerationSchema = z
  .object({
    cycleStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data-base (AAAA-MM-DD).")
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data-base inválida."),
  })
  .strict();
export type PcmsoGenerationValues = z.infer<typeof pcmsoGenerationSchema>;

export type PcmsoCompositionInput = {
  cycleStart: string;
  company: {
    razaoSocial: string;
    cnpj: string;
    cnae: string;
    mainActivity: string;
    riskGrade: number;
    activeEmployees: number;
  };
  coordinator: {
    name: string;
    crm: string;
    registrationUf: string | null;
    rqe: string | null;
    rqeExceptionReason: string | null;
    startsOn: string;
  };
  riskSources: { id: string; kind: string; title: string; version: string }[];
  risks: {
    exposureGroup: string;
    jobRole: string;
    description: string;
    agentType: string;
    possibleInjuries: string | null;
  }[];
  plan: {
    id: string;
    version: number;
    approvedAt: string;
    approvedByName: string;
    items: {
      exposureGroup: string;
      jobRole: string;
      procedureCode: string;
      otherDescription: string | null;
      decision: "kept" | "removed";
      periodicity: string;
      origin: "suggested" | "added";
    }[];
  };
  examiners: { name: string; registration: string }[];
  /** Critérios vigentes do médico coordenador (NR-7 7.5.4 c; NOB-153). */
  interpretationCriteria: CurrentCriterion[];
  /** Último relatório analítico arquivado (NOB-154); `null` se não houver. */
  analyticalReport: {
    id: string;
    version: number;
    periodStart: string;
    periodEnd: string;
    contentSha256: string;
  } | null;
  pendingSections: PcmsoReadinessItem[];
};

export type PcmsoContent = ReturnType<typeof composePcmso>;

const groupKey = (group: string, role: string) => `${group}\u0000${role}`;

export function composePcmso(input: PcmsoCompositionInput) {
  const groups = new Map<
    string,
    {
      exposureGroup: string;
      jobRole: string;
      risks: {
        description: string;
        agentType: string;
        possibleInjuries: string | null;
      }[];
      exams: {
        procedureCode: string;
        description: string;
        periodicity: string;
        origin: "suggested" | "added";
      }[];
    }
  >();
  const group = (exposureGroup: string, jobRole: string) => {
    const key = groupKey(exposureGroup, jobRole);
    if (!groups.has(key))
      groups.set(key, { exposureGroup, jobRole, risks: [], exams: [] });
    return groups.get(key)!;
  };
  for (const risk of input.risks)
    group(risk.exposureGroup, risk.jobRole).risks.push({
      description: risk.description,
      agentType: risk.agentType,
      possibleInjuries: risk.possibleInjuries,
    });
  for (const item of input.plan.items) {
    if (item.decision !== "kept") continue;
    group(item.exposureGroup, item.jobRole).exams.push({
      procedureCode: item.procedureCode,
      description:
        item.otherDescription ??
        getProcedure(item.procedureCode)?.description ??
        item.procedureCode,
      periodicity: item.periodicity,
      origin: item.origin,
    });
  }
  return {
    schemaVersion: PCMSO_CONTENT_SCHEMA_VERSION,
    status: "preview" as const,
    notice: PCMSO_PREVIEW_NOTICE,
    // Três conceitos distintos; a NR-7 não fixa prazo de validade do PCMSO.
    planningCycle: {
      start: input.cycleStart,
      end: addDays(addMonths(input.cycleStart, 12), -1),
      basis:
        "Ciclo de planejamento de 12 meses a partir da data-base, conforme a resposta do médico coordenador (MED-14). Não é prazo de validade normativo: a NR-7 não fixa validade do PCMSO.",
    },
    revision: {
      triggers: [
        "Mudança nos riscos identificados e classificados pelo PGR (NR-7 7.5.1; MED-14: risco novo).",
        "Inconsistência no inventário de riscos reavaliada com os responsáveis pelo PGR (NR-7 7.5.5).",
      ],
      administrativeUpdate:
        "Troca do médico responsável é atualização administrativa do PCMSO, não revisão do programa (MED-14).",
    },
    analyticalReport: input.analyticalReport
      ? {
          frequency: "Anual, considerando a data do último relatório (NR-7 7.6.2).",
          status: "available" as const,
          reportId: input.analyticalReport.id,
          version: input.analyticalReport.version,
          periodStart: input.analyticalReport.periodStart,
          periodEnd: input.analyticalReport.periodEnd,
          contentSha256: input.analyticalReport.contentSha256,
          note: "Último relatório analítico elaborado pelo médico coordenador (prévia arquivada, NR-7 7.5.4 e).",
        }
      : {
          frequency: "Anual, considerando a data do último relatório (NR-7 7.6.2).",
          status: "pending" as const,
          note: "Nenhum relatório analítico elaborado pelo médico coordenador ainda.",
        },
    company: input.company,
    coordinator: { ...input.coordinator, reference: "NR-7 7.4.1 c; 7.5.2" },
    riskBasis: {
      sources: input.riskSources,
      reference: "NR-7 7.5.1 (riscos identificados e classificados pelo PGR)",
    },
    examPlan: {
      id: input.plan.id,
      version: input.plan.version,
      approvedAt: input.plan.approvedAt,
      approvedBy: input.plan.approvedByName,
      reference: "NR-7 7.5.4 b; MED-15",
    },
    clinicalExam: CLINICAL_EXAM_NOTE,
    interpretation: {
      reference: "NR-7 7.5.4 c",
      authorship:
        "Critérios e condutas definidos pelo médico coordenador do PCMSO; o sistema não gera nem sugere texto clínico (DT-23).",
      items: criteriaCoverage(
        input.plan.items.filter((item) => item.decision === "kept"),
        input.interpretationCriteria,
      )
        .rows.filter((row) => row.inApprovedPlan)
        .map((row) =>
          row.current
            ? {
                procedureCode: row.procedureCode,
                description: row.description,
                status: "defined" as const,
                criteria: row.current.criteria,
                conduct: row.current.conduct,
                author: row.current.authorName,
                version: row.current.version,
                authoredAt: row.current.authoredAt,
              }
            : {
                procedureCode: row.procedureCode,
                description: row.description,
                status: "pending" as const,
                note: "Pendente de definição pelo médico coordenador.",
              },
        ),
    },
    groups: [...groups.values()].sort(
      (a, b) =>
        a.exposureGroup.localeCompare(b.exposureGroup, "pt-BR") ||
        a.jobRole.localeCompare(b.jobRole, "pt-BR"),
    ),
    examiners: input.examiners,
    pendingSections: input.pendingSections.map(({ code, message, reference }) => ({
      code,
      message,
      reference,
    })),
  };
}

/** JSON com chaves ordenadas: o mesmo conteúdo gera sempre o mesmo hash. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

export function pcmsoContentHash(content: PcmsoContent): string {
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}
