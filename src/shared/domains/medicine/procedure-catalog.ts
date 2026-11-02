import { z } from "zod";

import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import table27 from "./procedures/esocial-table-27.json";

/**
 * Catálogo de procedimentos diagnósticos = Tabela 27 do eSocial, importada verbatim do
 * anexo oficial por `scripts/medicine/import-esocial-table-27.ts` (MED-05). Nenhum
 * código é digitado à mão; código fora da tabela é recusado. O catálogo descreve o
 * procedimento — resultado clínico não faz parte dele e nunca vai para o ASO (MED-05).
 */
export type Procedure = { code: string; description: string };

export const PROCEDURE_CATALOG_SOURCE = {
  source: table27.source,
  version: table27.version,
  url: table27.url,
  sha256: table27.sha256,
  importedOn: table27.importedOn,
  count: table27.count,
} as const;

/** "Outros procedimentos diagnósticos não descritos anteriormente". */
export const OTHER_PROCEDURE_CODE = "9999";

const CATALOG: readonly Procedure[] = (table27.procedures as [string, string][]).map(
  ([code, description]) => ({ code, description }),
);
const BY_CODE = new Map(CATALOG.map((procedure) => [procedure.code, procedure]));

export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const INDEX = CATALOG.map((procedure) => ({
  procedure,
  text: normalizeForSearch(procedure.description),
}));

export function getProcedure(code: string): Procedure | null {
  return BY_CODE.get(code) ?? null;
}

export function isCatalogProcedureCode(code: string): boolean {
  return BY_CODE.has(code);
}

export const procedureSearchSchema = z.object({
  search: z.string().trim().max(100, "Pesquisa muito longa.").default(""),
});

/**
 * Busca por código (prefixo) ou descrição (todas as palavras, sem acento).
 * Ordem: código exato, prefixo de código, descrição que começa com o termo, demais.
 */
export function searchProcedures(
  search: string,
  page: PageParams = {},
): Paginated<Procedure> {
  const { limit, offset } = resolvePageParams(page);
  const term = normalizeForSearch(search);
  const tokens = term.split(" ").filter(Boolean);
  const rank = (entry: (typeof INDEX)[number]): number | null => {
    if (!term) return 3;
    const { code } = entry.procedure;
    if (code === term) return 0;
    if (/^\d+$/.test(term) && code.startsWith(term)) return 1;
    if (!tokens.every((token) => entry.text.includes(token))) return null;
    return entry.text.startsWith(term) ? 2 : 3;
  };
  const matches = INDEX.flatMap((entry) => {
    const score = rank(entry);
    return score === null ? [] : [{ score, procedure: entry.procedure }];
  }).sort(
    (a, b) => a.score - b.score || a.procedure.code.localeCompare(b.procedure.code),
  );
  return {
    rows: matches.slice(offset, offset + limit).map((match) => match.procedure),
    total: matches.length,
  };
}

/** Seleção de procedimento para um plano de exames: só códigos da Tabela 27. */
export const procedureSelectionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Código de procedimento deve ter 4 dígitos.")
      .refine(isCatalogProcedureCode, "Código fora da Tabela 27 do eSocial."),
    otherDescription: z.string().trim().max(500, "Máximo de 500 caracteres.").optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const described = Boolean(value.otherDescription);
    if (value.code === OTHER_PROCEDURE_CODE && !described)
      ctx.addIssue({
        code: "custom",
        path: ["otherDescription"],
        message: 'Descreva o procedimento quando usar o código 9999 ("Outros").',
      });
    if (value.code !== OTHER_PROCEDURE_CODE && described)
      ctx.addIssue({
        code: "custom",
        path: ["otherDescription"],
        message: "Descrição livre só é aceita no código 9999.",
      });
  });
export type ProcedureSelection = z.infer<typeof procedureSelectionSchema>;

/**
 * Linha de procedimento no ASO: indicação + data (NR-7 7.5.19.1, d; MED-05). O tipo não
 * tem campo de resultado de propósito — resultado clínico fica no prontuário.
 */
export type AsoProcedureLine = { code: string; label: string; performedOn: string };

export function toAsoProcedureLine(
  selection: ProcedureSelection,
  performedOn: string,
): AsoProcedureLine {
  const procedure = getProcedure(selection.code);
  if (!procedure) throw new Error(`Procedimento fora do catálogo: ${selection.code}`);
  const label =
    selection.code === OTHER_PROCEDURE_CODE && selection.otherDescription
      ? selection.otherDescription
      : procedure.description;
  return { code: procedure.code, label, performedOn };
}
