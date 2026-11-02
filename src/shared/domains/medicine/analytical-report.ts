import { createHash } from "node:crypto";

import { z } from "zod";

import { todayInSaoPaulo } from "@/shared/dates";
import { EXAM_TYPE_LABELS, type ExamType } from "../pgr/health-exams";
import { procedureLabel } from "./interpretation-criteria";
import { addDays, addMonths } from "./nr7-schedule-rules";
import { stableStringify } from "./pcmso-composition";

/**
 * Relatório analítico anual do PCMSO (NR-7 7.6.2 a 7.6.6; NOB-154). Regras:
 * - só dados reais registrados; o que o sistema não registra (resultados de exames, diagnósticos)
 *   sai como informação insuficiente (7.6.4), nunca como zero;
 * - contagem auditável: critérios gravados no próprio conteúdo;
 * - período anual contado a partir do último relatório (7.6.2), não do ano civil;
 * - simplificação do 7.6.6 só para quem se enquadra; a dispensa do 7.7.4 nunca é presumida;
 * - a discussão das variações (alínea f) é texto do médico coordenador, nunca gerado.
 */
export const ANALYTICAL_REPORT_SCHEMA_VERSION = 1;
export const ANALYTICAL_REPORT_NOTICE =
  "PRÉVIA — relatório sem assinatura do médico responsável pelo PCMSO e sem validade legal (MED-12).";

const isoDate = (label: string) =>
  z
    .string({ error: `Informe ${label}.` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `Informe ${label} (AAAA-MM-DD).`)
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), `${label} inválida.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max.toLocaleString("pt-BR")} caracteres.`)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const analyticalReportInputSchema = z
  .object({
    periodStart: isoDate("a data inicial do período"),
    periodEnd: isoDate("a data final do período"),
    simplified: z.boolean().default(false),
    variationDiscussion: optionalText(10000),
    insufficiencyNote: optionalText(5000),
  })
  .strict();
export type AnalyticalReportValues = z.output<typeof analyticalReportInputSchema>;

export const analyticalReportPeriodSchema = analyticalReportInputSchema.pick({
  periodStart: true,
  periodEnd: true,
});

// ── Regras do período e do enquadramento ─────────────────────────────────────

/** Parte do conteúdo usada na comparação (alínea f); vale para qualquer versão arquivada. */
export type IndicatorSource = {
  items: {
    a: { total: number; byType: { label: string; count: number }[] };
    b: {
      total: number;
      byProcedure: { procedureCode: string; description: string; count: number }[];
    };
    e: { status: string; total?: number; byType?: { label: string; count: number }[] };
  };
};

export type PreviousReportRef = {
  id: string;
  version: number;
  periodStart: string;
  periodEnd: string;
  content: IndicatorSource;
};

/** Problemas do período (vazio = válido). O próximo relatório começa no dia seguinte ao anterior. */
export function periodIssues(
  period: { periodStart: string; periodEnd: string },
  previous: { periodEnd: string } | null,
  today = todayInSaoPaulo(),
): { field: "periodStart" | "periodEnd"; message: string }[] {
  const issues: { field: "periodStart" | "periodEnd"; message: string }[] = [];
  if (period.periodEnd < period.periodStart)
    issues.push({
      field: "periodEnd",
      message: "O fim do período é anterior ao início.",
    });
  if (period.periodEnd > today)
    issues.push({
      field: "periodEnd",
      message: "O período não pode terminar no futuro.",
    });
  const maxEnd = addDays(addMonths(period.periodStart, 12), -1);
  if (period.periodEnd > maxEnd)
    issues.push({
      field: "periodEnd",
      message: `O relatório é anual: o período vai até ${maxEnd}, no máximo (NR-7 7.6.2).`,
    });
  if (previous) {
    const expected = addDays(previous.periodEnd, 1);
    if (period.periodStart !== expected)
      issues.push({
        field: "periodStart",
        message: `O relatório considera a data do último relatório (NR-7 7.6.2): o período começa em ${expected}.`,
      });
  }
  return issues;
}

/** NR-7 7.6.6: GR 1–2 com até 25 empregados, ou GR 3–4 com até 10, podem relatar só a e b. */
export function simplificationEligibility(riskGrade: number | null, employees: number) {
  if (riskGrade === null)
    return {
      eligible: false,
      basis:
        "Grau de risco da empresa não cadastrado: a simplificação do 7.6.6 não pode ser verificada.",
    };
  const limit = riskGrade <= 2 ? 25 : 10;
  const eligible = employees <= limit;
  return {
    eligible,
    basis: `Grau de risco ${riskGrade} com ${employees} empregado(s) no cadastro; limite do 7.6.6: ${limit}.`,
  };
}

// ── Contagens (dados reais) ──────────────────────────────────────────────────

export type ClinicalExamRow = {
  employeeId: string;
  examType: ExamType;
  performedAt: string;
};

/** Exames clínicos distintos (funcionário + tipo + data): registros repetidos contam uma vez. */
export function countClinicalExams(rows: ClinicalExamRow[]) {
  const seen = new Set<string>();
  const byType = new Map<ExamType, number>();
  for (const row of rows) {
    const key = `${row.employeeId}\u0000${row.examType}\u0000${row.performedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byType.set(row.examType, (byType.get(row.examType) ?? 0) + 1);
  }
  return {
    total: seen.size,
    duplicatesIgnored: rows.length - seen.size,
    byType: (Object.keys(EXAM_TYPE_LABELS) as ExamType[])
      .filter((type) => byType.has(type))
      .map((type) => ({
        examType: type,
        label: EXAM_TYPE_LABELS[type],
        count: byType.get(type)!,
      })),
  };
}

export type ProcedureRow = { procedureCode: string; otherDescription: string | null };

export function countProcedures(rows: ProcedureRow[]) {
  const byKey = new Map<
    string,
    { procedureCode: string; description: string; count: number }
  >();
  for (const row of rows) {
    const description = procedureLabel(row.procedureCode, row.otherDescription);
    const key = `${row.procedureCode}\u0000${description.toLocaleLowerCase("pt-BR")}`;
    const entry = byKey.get(key) ?? {
      procedureCode: row.procedureCode,
      description,
      count: 0,
    };
    entry.count += 1;
    byKey.set(key, entry);
  }
  return {
    total: rows.length,
    byProcedure: [...byKey.values()].sort(
      (a, b) =>
        a.procedureCode.localeCompare(b.procedureCode) ||
        a.description.localeCompare(b.description, "pt-BR"),
    ),
  };
}

export const CAT_TYPE_LABELS = {
  typical: "Acidente típico",
  commute: "Acidente de trajeto",
  occupational_disease: "Doença ocupacional",
} as const;
export type CatType = keyof typeof CAT_TYPE_LABELS;

export function countCats(rows: { type: CatType }[], withoutIssueDate: number) {
  const byType = new Map<CatType, number>();
  for (const row of rows) byType.set(row.type, (byType.get(row.type) ?? 0) + 1);
  return {
    total: rows.length,
    withoutIssueDate,
    byType: (Object.keys(CAT_TYPE_LABELS) as CatType[])
      .filter((type) => byType.has(type))
      .map((type) => ({ type, label: CAT_TYPE_LABELS[type], count: byType.get(type)! })),
  };
}

// ── Composição ───────────────────────────────────────────────────────────────

export type AnalyticalReportInput = {
  period: { periodStart: string; periodEnd: string };
  company: { razaoSocial: string; cnpj: string | null; riskGrade: number | null };
  employees: number;
  author: { name: string; registration: string };
  simplified: boolean;
  clinical: ReturnType<typeof countClinicalExams> & { unverifiedOrigin: number };
  complementary: ReturnType<typeof countProcedures>;
  cats: ReturnType<typeof countCats>;
  previous: PreviousReportRef | null;
  variationDiscussion: string | null;
  insufficiencyNote: string | null;
};

const NOT_REQUIRED = (item: string) => ({
  status: "not_required" as const,
  note: `Alínea ${item} não exigida: a organização se enquadra no 7.6.6 e o coordenador optou pelo relatório simplificado (alíneas a e b).`,
  reference: "NR-7 7.6.6",
});

type Indicator = { indicator: string; value: number };

/** Indicadores comparáveis de um relatório: só os que estavam disponíveis nele. */
export function comparableIndicators(content: IndicatorSource): Indicator[] {
  const out: Indicator[] = [];
  const a = content.items.a;
  out.push({ indicator: "Exames clínicos realizados", value: a.total });
  for (const t of a.byType)
    out.push({ indicator: `Exames clínicos — ${t.label}`, value: t.count });
  const b = content.items.b;
  out.push({ indicator: "Exames complementares realizados", value: b.total });
  for (const p of b.byProcedure)
    out.push({ indicator: `Exame ${p.procedureCode} ${p.description}`, value: p.count });
  const e = content.items.e;
  if (e.status === "registered_only") {
    out.push({ indicator: "CAT registradas", value: e.total ?? 0 });
    for (const t of e.byType ?? [])
      out.push({ indicator: `CAT — ${t.label}`, value: t.count });
  }
  return out;
}

/** Compara só indicadores presentes nos dois relatórios; ausente num deles conta 0 só se o item existia. */
function compareWithPrevious(
  current: Indicator[],
  previous: Indicator[],
  currentHasCats: boolean,
  previousHasCats: boolean,
) {
  const isCat = (name: string) => name.startsWith("CAT");
  const comparable = (name: string) =>
    !isCat(name) || (currentHasCats && previousHasCats);
  const prev = new Map(previous.map((i) => [i.indicator, i.value]));
  const cur = new Map(current.map((i) => [i.indicator, i.value]));
  const names = [...new Set([...prev.keys(), ...cur.keys()])].filter(comparable);
  return names.map((indicator) => {
    const before = prev.get(indicator) ?? 0;
    const now = cur.get(indicator) ?? 0;
    return { indicator, previous: before, current: now, difference: now - before };
  });
}

export function composeAnalyticalReport(input: AnalyticalReportInput) {
  const simplified = input.simplified;
  const eligibility = simplificationEligibility(input.company.riskGrade, input.employees);
  const catItem = simplified
    ? NOT_REQUIRED("e")
    : {
        status: "registered_only" as const,
        ...input.cats,
        criteria:
          "CAT com número registrado no módulo de incidentes, não canceladas, com data de emissão no período. A plataforma não emite CAT nem recebe do eSocial: zero significa nenhuma CAT registrada no sistema, não ausência de eventos.",
        reference: "NR-7 7.6.2 e",
      };

  const base = {
    schemaVersion: ANALYTICAL_REPORT_SCHEMA_VERSION,
    status: "preview" as const,
    notice: ANALYTICAL_REPORT_NOTICE,
    period: {
      start: input.period.periodStart,
      end: input.period.periodEnd,
      basis: input.previous
        ? `Anual, a partir do relatório anterior (versão ${input.previous.version}, ${input.previous.periodStart} a ${input.previous.periodEnd}) — NR-7 7.6.2.`
        : "Primeiro relatório analítico registrado no sistema para a empresa — NR-7 7.6.2.",
    },
    company: {
      razaoSocial: input.company.razaoSocial,
      cnpj: input.company.cnpj ?? "",
      riskGrade: input.company.riskGrade,
      employees: input.employees,
      employeesBasis:
        "Empregados ativos e afastados no cadastro na data da geração; o sistema não guarda histórico de efetivo.",
    },
    author: { ...input.author, role: "Médico responsável pelo PCMSO (NR-7 7.6.2)" },
    simplification: { ...eligibility, applied: simplified, reference: "NR-7 7.6.6" },
    exemption: {
      status: "not_verifiable" as const,
      note: "Porte (MEI, ME, EPP) e dispensa de PCMSO (NR-01 1.8.6) não são cadastrados: a dispensa do relatório (NR-7 7.7.4) não é presumida.",
      reference: "NR-7 7.7.4",
    },
  };

  const items = {
    a: {
      status: "available" as const,
      total: input.clinical.total,
      byType: input.clinical.byType,
      duplicatesIgnored: input.clinical.duplicatesIgnored,
      unverifiedOrigin: input.clinical.unverifiedOrigin,
      criteria:
        "Exames clínicos registrados com data de realização no período e realizados nesta empresa (empresa de origem registrada ou confirmada, MED-07). Registros repetidos (mesmo funcionário, tipo e data) contam uma vez. Exames sem origem comprovada ficam fora e são informados à parte.",
      reference: "NR-7 7.6.2 a",
    },
    b: {
      status: "available" as const,
      total: input.complementary.total,
      byProcedure: input.complementary.byProcedure,
      criteria:
        "Exames complementares registrados com data de realização no período, vinculados a exames desta empresa; código e descrição da Tabela 27 do eSocial.",
      reference: "NR-7 7.6.2 b",
    },
    c: simplified
      ? NOT_REQUIRED("c")
      : {
          status: "insufficient" as const,
          note: "Resultados de exames complementares não são registrados no sistema: não há como apurar a estatística de resultados anormais. Ausência de dado não significa ausência de resultados anormais.",
          reference: "NR-7 7.6.2 c; 7.6.4",
        },
    d: simplified
      ? NOT_REQUIRED("d")
      : {
          status: "insufficient" as const,
          note: "Diagnósticos de doenças relacionadas ao trabalho não são registrados no sistema: incidência e prevalência não podem ser calculadas. Nada é inferido de CID ausente, aptidão, risco ou nome de exame.",
          reference: "NR-7 7.6.2 d; 7.6.4",
        },
    e: catItem,
  };

  const f = simplified
    ? NOT_REQUIRED("f")
    : input.previous
      ? {
          status: "compared" as const,
          previous: {
            id: input.previous.id,
            version: input.previous.version,
            periodStart: input.previous.periodStart,
            periodEnd: input.previous.periodEnd,
          },
          comparisons: compareWithPrevious(
            comparableIndicators({ items }),
            comparableIndicators(input.previous.content),
            !simplified,
            input.previous.content.items.e.status === "registered_only",
          ),
          discussion: input.variationDiscussion ?? "",
          discussionAuthor: input.author.name,
          reference: "NR-7 7.6.2 f",
        }
      : {
          status: "no_previous" as const,
          note: "Não há relatório analítico anterior registrado no sistema para comparação. Nenhum histórico é presumido.",
          reference: "NR-7 7.6.2 f",
        };

  return {
    ...base,
    items: { ...items, f },
    transferredRecords: {
      status: "not_recorded" as const,
      note: "O sistema não registra a transferência de prontuários médicos (NR-7 7.6.1.2); prontuários transferidos não puderam ser considerados automaticamente.",
      reference: "NR-7 7.6.3",
    },
    insufficiency: {
      doctorNote: input.insufficiencyNote,
      reference: "NR-7 7.6.4",
    },
    presentation: {
      status: "pending" as const,
      note: "Apresentação e discussão com os responsáveis por SST e a CIPA, quando existente: ainda sem registro no sistema.",
      reference: "NR-7 7.6.5",
    },
  };
}
export type AnalyticalReportContent = ReturnType<typeof composeAnalyticalReport>;

export function analyticalReportHash(content: AnalyticalReportContent): string {
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}
