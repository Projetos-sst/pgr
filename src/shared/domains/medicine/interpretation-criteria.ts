import { z } from "zod";

import {
  getProcedure,
  OTHER_PROCEDURE_CODE,
  procedureSelectionSchema,
} from "./procedure-catalog";

/**
 * Critérios de interpretação dos achados e planejamento das condutas por exame (NR-7 7.5.4 c;
 * NOB-153). O texto é sempre do médico coordenador; o sistema só guarda versões e confere quais
 * exames do plano aprovado ainda não têm critério. Não sugere nem completa texto (DT-23).
 */
export const INTERPRETATION_TEXT_MAX = 5000;

const clinicalText = (label: string) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(1, `Informe ${label}.`)
    .max(
      INTERPRETATION_TEXT_MAX,
      `Máximo de ${INTERPRETATION_TEXT_MAX.toLocaleString("pt-BR")} caracteres.`,
    );

export const interpretationCriteriaInputSchema = z
  .object({
    code: procedureSelectionSchema.shape.code,
    otherDescription: z
      .string()
      .trim()
      .max(500, "Máximo de 500 caracteres.")
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    criteria: clinicalText("os critérios de interpretação dos achados"),
    conduct: clinicalText("o planejamento das condutas"),
  })
  .strict()
  .superRefine((value, ctx) => {
    const parsed = procedureSelectionSchema.safeParse({
      code: value.code,
      otherDescription: value.otherDescription,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        if (issue.path[0] === "otherDescription")
          ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
export type InterpretationCriteriaValues = z.output<
  typeof interpretationCriteriaInputSchema
>;

export function procedureLabel(code: string, otherDescription: string | null): string {
  if (code === OTHER_PROCEDURE_CODE) return otherDescription ?? "Outro procedimento";
  return getProcedure(code)?.description ?? `Procedimento ${code}`;
}

const norm = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("pt-BR");

/** Chave do procedimento: código + descrição livre (só no 9999). */
export const procedureKey = (code: string, otherDescription: string | null | undefined) =>
  `${code}\u0000${norm(otherDescription)}`;

export type CurrentCriterion = {
  id: string;
  procedureCode: string;
  otherDescription: string | null;
  version: number;
  criteria: string;
  conduct: string;
  authorName: string;
  authoredAt: string;
};

export type CoverageRow = {
  procedureCode: string;
  otherDescription: string | null;
  description: string;
  inApprovedPlan: boolean;
  current: CurrentCriterion | null;
};

/**
 * Exames mantidos no plano aprovado (sem repetir entre grupos) com o critério vigente de cada um,
 * mais critérios já definidos para exames fora do plano atual. `missing` lista os do plano sem
 * critério.
 */
export function criteriaCoverage(
  planned: { procedureCode: string; otherDescription: string | null }[],
  current: CurrentCriterion[],
) {
  const byKey = new Map(
    current.map((c) => [procedureKey(c.procedureCode, c.otherDescription), c]),
  );
  const rows: CoverageRow[] = [];
  const seen = new Set<string>();
  for (const item of planned) {
    const key = procedureKey(item.procedureCode, item.otherDescription);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      procedureCode: item.procedureCode,
      otherDescription: item.otherDescription,
      description: procedureLabel(item.procedureCode, item.otherDescription),
      inApprovedPlan: true,
      current: byKey.get(key) ?? null,
    });
  }
  for (const c of current) {
    const key = procedureKey(c.procedureCode, c.otherDescription);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      procedureCode: c.procedureCode,
      otherDescription: c.otherDescription,
      description: procedureLabel(c.procedureCode, c.otherDescription),
      inApprovedPlan: false,
      current: c,
    });
  }
  rows.sort(
    (a, b) =>
      Number(b.inApprovedPlan) - Number(a.inApprovedPlan) ||
      a.procedureCode.localeCompare(b.procedureCode) ||
      a.description.localeCompare(b.description, "pt-BR"),
  );
  const missing = rows
    .filter((r) => r.inApprovedPlan && !r.current)
    .map(({ procedureCode, description }) => ({ procedureCode, description }));
  return { rows, missing };
}
