import { createHash } from "node:crypto";
import { z } from "zod";

import { stableStringify } from "@/shared/domains/medicine/pcmso-composition";
import { requiredString } from "@/shared/domains/pgr/form-fields";

export const RETENTION_CATEGORIES = [
  "pgr_documents",
  "pgr_review_records",
  "signature_evidence",
  "sst_records",
  "health_records",
] as const;
export type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];

export const RETENTION_STARTING_POINTS = [
  "contract_end",
  "company_closure",
  "document_issue",
  "employee_termination",
] as const;
export type RetentionStartingPoint = (typeof RETENTION_STARTING_POINTS)[number];

export const RETENTION_STARTING_POINT_LABELS: Record<RetentionStartingPoint, string> = {
  contract_end: "Término do contrato do escritório com a plataforma",
  company_closure: "Encerramento do atendimento à empresa",
  document_issue: "Emissão do documento",
  employee_termination: "Desligamento do trabalhador",
};

export const RETENTION_CATEGORY_CATALOG: Record<
  RetentionCategory,
  { label: string; records: readonly string[] }
> = {
  pgr_documents: {
    label: "Documentos do PGR",
    records: [
      "Emissões finais, amostras e demais arquivos do PGR no acervo, com todas as versões",
      "Cabeçalho do PGR e histórico de revisões",
    ],
  },
  pgr_review_records: {
    label: "Revisão e emissão do PGR",
    records: [
      "Amostras enviadas para revisão e pareceres recebidos",
      "Eventos de revisão por documento e de emissão final",
      "Versões dos textos padrão usados em cada geração",
    ],
  },
  signature_evidence: {
    label: "Evidências de assinatura",
    records: [
      "Pedidos de assinatura do PGR e das ordens de serviço",
      "Capturas de assinatura: quem assinou, quando e por qual meio",
    ],
  },
  sst_records: {
    label: "Registros de Segurança do Trabalho",
    records: [
      "Inventário de riscos, avaliações e medidas de controle",
      "Planos de ação, ordens de serviço, inspeções e permissões de trabalho",
      "Entregas de EPI, treinamentos e auditorias de risco",
    ],
  },
  health_records: {
    label: "Registros de saúde",
    records: ["Exames ocupacionais, ASO e PCMSO", "Prontuário, afastamentos e acidentes"],
  },
};

const MAX_RETENTION_MONTHS = 1200;
const MAX_NOTICE_DAYS = 3650;
const MAX_NOTICES = 6;
const MAX_TEXT = 2000;

const categoryTermSchema = z.object({
  category: z.enum(RETENTION_CATEGORIES, "Categoria desconhecida."),
  retentionMonths: z.coerce
    .number("Informe o prazo em meses.")
    .int("Informe o prazo em meses inteiros.")
    .min(1, "O prazo mínimo é de 1 mês.")
    .max(MAX_RETENTION_MONTHS, "O prazo máximo é de 1200 meses."),
  startingPoint: z.enum(RETENTION_STARTING_POINTS, "Marco inicial desconhecido."),
});
export type RetentionCategoryTerm = z.infer<typeof categoryTermSchema>;

const coversEveryCategoryOnce = (rows: RetentionCategoryTerm[]) =>
  rows.length === RETENTION_CATEGORIES.length &&
  RETENTION_CATEGORIES.every((category) => rows.some((row) => row.category === category));

const categoryOrder = (row: RetentionCategoryTerm) =>
  RETENTION_CATEGORIES.indexOf(row.category);

export const retentionTermsSchema = z.object({
  categories: z
    .array(categoryTermSchema)
    .refine(coversEveryCategoryOnce, "Informe cada categoria uma única vez.")
    .transform((rows) => [...rows].sort((a, b) => categoryOrder(a) - categoryOrder(b))),
  noticeDaysBefore: z
    .array(
      z.coerce
        .number("Informe os dias de antecedência.")
        .int("Informe dias inteiros.")
        .min(1, "O aviso precisa de ao menos 1 dia de antecedência.")
        .max(MAX_NOTICE_DAYS, "Antecedência acima do permitido."),
    )
    .min(1, "Informe ao menos um aviso.")
    .max(MAX_NOTICES, "Informe no máximo 6 avisos.")
    .refine((days) => new Set(days).size === days.length, "Aviso repetido.")
    .transform((days) => [...days].sort((a, b) => b - a)),
  postClosureAccess: requiredString("Descreva o acesso após o encerramento.").max(
    MAX_TEXT,
  ),
  discardAuthorization: requiredString("Descreva quem autoriza o descarte.").max(
    MAX_TEXT,
  ),
});
export type RetentionTerms = z.infer<typeof retentionTermsSchema>;

const approvalSchema = z.object({
  approverName: requiredString("Informe quem aprovou a política.").max(200),
  approverRole: requiredString("Informe o cargo de quem aprovou.").max(200),
  approvedOn: z.iso.date("Data inválida (use AAAA-MM-DD)."),
  reference: requiredString("Informe onde a aprovação está registrada.").max(MAX_TEXT),
});
export type RetentionApproval = z.infer<typeof approvalSchema>;

export const retentionPolicyVersionSchema = z.discriminatedUnion(
  "status",
  [
    z.object({ status: z.literal("proposed"), terms: retentionTermsSchema }),
    z.object({
      status: z.literal("approved"),
      terms: retentionTermsSchema,
      approval: approvalSchema,
    }),
  ],
  "Informe se a versão é proposta ou aprovada.",
);
export type RetentionPolicyVersionInput = z.infer<typeof retentionPolicyVersionSchema>;
export type RetentionPolicyStatus = RetentionPolicyVersionInput["status"];

export const PROPOSED_RETENTION_TERMS: RetentionTerms = {
  categories: [
    { category: "pgr_documents", retentionMonths: 12, startingPoint: "contract_end" },
    {
      category: "pgr_review_records",
      retentionMonths: 12,
      startingPoint: "contract_end",
    },
    {
      category: "signature_evidence",
      retentionMonths: 12,
      startingPoint: "contract_end",
    },
    { category: "sst_records", retentionMonths: 12, startingPoint: "contract_end" },
    {
      category: "health_records",
      retentionMonths: 240,
      startingPoint: "employee_termination",
    },
  ],
  noticeDaysBefore: [90, 60, 30],
  postClosureAccess:
    "Proposta da SEG-12, ainda sem aprovação: o escritório mantém consulta e exportação durante todo o prazo de guarda.",
  discardAuthorization:
    "Proposta da SEG-12, ainda sem aprovação: descarte só com autorização escrita do responsável pela política.",
};

export function retentionTermsSha256(terms: RetentionTerms): string {
  return createHash("sha256").update(stableStringify(terms)).digest("hex");
}

export type RetentionPolicyState =
  | { status: "not_approved"; reason: "no_policy" | "latest_version_proposed" }
  | { status: "approved"; version: number; termsSha256: string };

export function retentionPolicyState(
  latest: { status: RetentionPolicyStatus; version: number; termsSha256: string } | null,
): RetentionPolicyState {
  if (!latest) return { status: "not_approved", reason: "no_policy" };
  if (latest.status === "proposed")
    return { status: "not_approved", reason: "latest_version_proposed" };
  return {
    status: "approved",
    version: latest.version,
    termsSha256: latest.termsSha256,
  };
}

export function retentionPolicyStateLabel(state: RetentionPolicyState): string {
  if (state.status === "approved") return `Aprovada (versão ${state.version})`;
  return state.reason === "no_policy"
    ? "Não aprovada: nenhuma versão registrada"
    : "Não aprovada: a versão mais recente é só proposta";
}
