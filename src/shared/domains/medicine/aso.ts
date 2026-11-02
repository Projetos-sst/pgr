import { createHash } from "node:crypto";

import { z } from "zod";

import { todayInSaoPaulo } from "@/shared/dates";
import { EXAM_TYPE_LABELS, type ExamAptitude, type ExamType } from "../pgr/health-exams";
import { stableStringify } from "./pcmso-composition";
import {
  getProcedure,
  OTHER_PROCEDURE_CODE,
  procedureSelectionSchema,
} from "./procedure-catalog";
import {
  canUseMedicalRisk,
  type MedicalRiskStatus,
  type SourceFreshness,
} from "./risk-sources";

/**
 * ASO (NOB-152, filha da NOB-110): conferência do conteúdo mínimo da NR-7 7.5.19.1 e prévia
 * montada só com o que está cadastrado. Regras:
 * - a conclusão apto/inapto é a registrada do médico examinador; o sistema não conclui nada (MED-01);
 * - o ASO traz apto ou inapto (7.5.19.1 e); restrição e observações clínicas ficam fora (MED-10, DT-21);
 * - riscos só validados de fonte vigente; pendentes bloqueiam; ausência de risco nunca é presumida
 *   (MED-09, DT-12) e a declaração de inexistência ainda não existe no sistema;
 * - só exames da empresa onde foram realizados (MED-07);
 * - sem assinatura verificável (MED-12) o documento é prévia, nunca ASO emitido.
 */
export const ASO_CONTENT_SCHEMA_VERSION = 1;
export const ASO_PREVIEW_NOTICE =
  "PRÉVIA — sem assinatura do médico examinador; não é ASO emitido e não tem validade legal (MED-12).";

// ── Procedimentos realizados (7.5.19.1 d) ────────────────────────────────────

export const examProcedureInputSchema = z
  .object({
    code: procedureSelectionSchema.shape.code,
    otherDescription: z
      .string()
      .trim()
      .max(500, "Máximo de 500 caracteres.")
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    performedAt: z.iso
      .date("Data inválida (use AAAA-MM-DD)")
      .refine((value) => value <= todayInSaoPaulo(), {
        message: "Data de realização não pode ser no futuro",
      }),
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
export type ExamProcedureValues = z.output<typeof examProcedureInputSchema>;

export function procedureLabel(code: string, otherDescription: string | null): string {
  if (code === OTHER_PROCEDURE_CODE) return otherDescription ?? "Outro procedimento";
  return getProcedure(code)?.description ?? `Procedimento ${code}`;
}

// ── Riscos aplicáveis ao funcionário (7.5.19.1 c) ────────────────────────────

export type AsoRiskSource = {
  freshness: SourceFreshness;
  superseded: boolean;
  risks: {
    status: MedicalRiskStatus;
    content: {
      exposureGroup: string;
      jobRole?: string;
      description: string;
      agentType: string;
      originGesId?: string;
    };
  }[];
};

const norm = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("pt-BR");

/**
 * Riscos das fontes vigentes que se aplicam ao GES e à função do funcionário. Fonte interna casa
 * pelo GES de origem; externa, pelo nome do grupo. Função vazia na fonte vale para o grupo todo.
 * Rejeitados não contam; pendentes são contados à parte e bloqueiam o ASO.
 */
export function employeeRisks(
  sources: AsoRiskSource[],
  employee: { gesId: string | null; gesName: string | null; jobRole: string | null },
) {
  const live = sources.filter((source) => !source.superseded);
  const validated: { description: string; agentType: string }[] = [];
  let pending = 0;
  let usableSources = 0;
  for (const source of live) {
    let usable = false;
    for (const risk of source.risks) {
      const c = risk.content;
      const sameGroup = c.originGesId
        ? c.originGesId === employee.gesId
        : norm(c.exposureGroup) !== "" &&
          norm(c.exposureGroup) === norm(employee.gesName);
      const sameRole = !norm(c.jobRole) || norm(c.jobRole) === norm(employee.jobRole);
      if (canUseMedicalRisk(risk.status, source.freshness)) usable = true;
      if (!sameGroup || !sameRole) continue;
      if (risk.status === "pending") pending += 1;
      else if (canUseMedicalRisk(risk.status, source.freshness))
        validated.push({ description: c.description, agentType: c.agentType });
    }
    if (usable) usableSources += 1;
  }
  const seen = new Set<string>();
  const unique = validated.filter((r) => {
    const key = `${r.agentType}\u0000${norm(r.description)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { validated: unique, pending, usableSources };
}

// ── Conferência (checklist 7.5.19.1) ─────────────────────────────────────────

export const ASO_ITEMS = ["a", "b", "c", "d", "e", "f", "g"] as const;
export type AsoItem = (typeof ASO_ITEMS)[number];

export const ASO_ITEM_LABELS: Record<AsoItem, string> = {
  a: "Razão social e CNPJ ou CAEPF da organização",
  b: "Nome completo, CPF e função do empregado",
  c: "Riscos do PGR com controle médico no PCMSO, ou sua inexistência",
  d: "Exames clínico e complementares realizados, com datas",
  e: "Apto ou inapto para a função",
  f: "Médico responsável pelo PCMSO, se houver",
  g: "Data, registro e assinatura do médico examinador",
};

export type AsoReadinessItem = {
  code: string;
  item: AsoItem | "company_of_exam";
  severity: "blocking" | "warning";
  message: string;
  reference: string;
};

export type AsoFacts = {
  exam: {
    examType: ExamType;
    performedAt: string;
    aptitude: ExamAptitude;
    companyId: string;
  };
  employee: {
    fullName: string;
    cpf: string;
    companyId: string;
    jobRole: string | null;
    gesId: string | null;
    gesName: string | null;
  };
  company: { razaoSocial: string; cnpj: string | null };
  examiner: {
    name: string;
    profession: string;
    registration: string;
    registrationUf: string | null;
  } | null;
  coordinator: { name: string; registration: string; rqe: string | null } | null;
  risks: ReturnType<typeof employeeRisks>;
  procedures: {
    procedureCode: string;
    otherDescription: string | null;
    performedAt: string;
  }[];
  /** Exames mantidos no plano aprovado para o grupo/função; `null` sem plano aprovado. */
  plannedProcedures: { procedureCode: string; otherDescription: string | null }[] | null;
};

const REF = "NR-7 7.5.19.1";

export function asoReadiness(facts: AsoFacts): AsoReadinessItem[] {
  const items: AsoReadinessItem[] = [];
  const block = (
    code: string,
    item: AsoReadinessItem["item"],
    message: string,
    reference = REF,
  ) => items.push({ code, item, severity: "blocking", message, reference });
  const warn = (
    code: string,
    item: AsoReadinessItem["item"],
    message: string,
    reference = REF,
  ) => items.push({ code, item, severity: "warning", message, reference });

  if (facts.exam.companyId !== facts.employee.companyId)
    block(
      "exam_other_company",
      "company_of_exam",
      "O exame foi realizado em outra empresa e não serve ao ASO da empresa atual do funcionário.",
      "MED-07",
    );

  if (!facts.company.razaoSocial.trim())
    block("company_name", "a", "Empresa sem razão social.");
  if (!facts.company.cnpj?.trim())
    block(
      "company_document",
      "a",
      "Empresa sem CNPJ cadastrado. O CAEPF ainda não é aceito pelo sistema.",
    );

  if (!facts.employee.fullName.trim())
    block("employee_name", "b", "Funcionário sem nome.");
  if (!facts.employee.cpf.trim()) block("employee_cpf", "b", "Funcionário sem CPF.");
  if (!facts.employee.jobRole?.trim())
    block("employee_job_role", "b", "Funcionário sem função cadastrada.");

  if (!facts.employee.gesId)
    block(
      "employee_ges",
      "c",
      "Funcionário sem GES: não há como relacionar os riscos do PGR à função.",
    );
  else if (facts.risks.pending > 0)
    block(
      "risks_pending",
      "c",
      `${facts.risks.pending} risco(s) do grupo do funcionário ainda pendente(s) de validação técnica. O ASO não sai com riscos pendentes.`,
      "MED-09",
    );
  else if (facts.risks.usableSources === 0)
    block(
      "risk_source",
      "c",
      "Nenhuma fonte de riscos vigente com riscos validados para esta empresa.",
      "MED-09",
    );
  else if (facts.risks.validated.length === 0)
    block(
      "risks_absence_not_declared",
      "c",
      "Nenhum risco validado para o grupo e a função. A inexistência de riscos só pode constar por declaração do responsável pelo PGR, que o sistema ainda não registra; ausência de cadastro não comprova ausência de risco.",
      "MED-09, DT-12",
    );

  if (facts.plannedProcedures === null)
    warn(
      "exam_plan_missing",
      "d",
      "Sem plano de exames aprovado: os exames realizados não podem ser conferidos com o PCMSO.",
      "NOB-150",
    );
  else {
    const done = new Set(
      facts.procedures.map((p) => `${p.procedureCode}\u0000${norm(p.otherDescription)}`),
    );
    for (const planned of facts.plannedProcedures)
      if (!done.has(`${planned.procedureCode}\u0000${norm(planned.otherDescription)}`))
        warn(
          `planned_not_done_${planned.procedureCode}`,
          "d",
          `Exame previsto no plano aprovado sem registro de realização: ${planned.procedureCode} ${procedureLabel(planned.procedureCode, planned.otherDescription)}. A indicação para este tipo de exame é do médico.`,
          "NR-7 7.5.19.1 d",
        );
  }

  if (!facts.examiner)
    block(
      "examiner_missing",
      "e",
      "Médico examinador não informado no exame. Apto ou inapto é conclusão do examinador, não do sistema.",
      "MED-01",
    );
  else {
    if (facts.examiner.profession !== "physician")
      block(
        "examiner_not_physician",
        "g",
        "O examinador do ASO precisa ser médico (CRM).",
      );
    if (!facts.examiner.registrationUf)
      block("examiner_registration", "g", "CRM do médico examinador sem UF.");
  }
  if (facts.exam.aptitude === "fit_with_restrictions")
    warn(
      "aptitude_restriction",
      "e",
      "O ASO registra apenas apto; a descrição da restrição fica no prontuário, fora do ASO.",
      "NR-7 7.5.19.1 e; MED-10; DT-21",
    );

  if (!facts.coordinator)
    warn(
      "coordinator_missing",
      "f",
      "Sem médico responsável pelo PCMSO designado na data do exame. A NR-7 pede o nome “se houver”; o Dr. Alcides pede o coordenador com RQE no ASO.",
      "NR-7 7.5.19.1 f; MED-01",
    );

  warn(
    "signature_unavailable",
    "g",
    "Não há assinatura verificável do médico examinador no sistema: o documento sai como prévia.",
    "MED-12",
  );
  return items;
}

/** Itens a–g do 7.5.19.1 com o estado da conferência (bloqueio vence aviso). */
export function asoChecklist(items: AsoReadinessItem[]) {
  return ASO_ITEMS.map((item) => {
    const related = items.filter((i) => i.item === item);
    const status = related.some((i) => i.severity === "blocking")
      ? ("missing" as const)
      : related.length
        ? ("warning" as const)
        : ("ok" as const);
    return { item, label: ASO_ITEM_LABELS[item], status };
  });
}

// ── Composição da prévia ─────────────────────────────────────────────────────

export function composeAso(facts: AsoFacts) {
  const readiness = asoReadiness(facts);
  return {
    schemaVersion: ASO_CONTENT_SCHEMA_VERSION,
    status: "preview" as const,
    notice: ASO_PREVIEW_NOTICE,
    reference: REF,
    examType: { code: facts.exam.examType, label: EXAM_TYPE_LABELS[facts.exam.examType] },
    company: { razaoSocial: facts.company.razaoSocial, cnpj: facts.company.cnpj ?? "" },
    employee: {
      fullName: facts.employee.fullName,
      cpf: facts.employee.cpf,
      jobRole: facts.employee.jobRole ?? "",
    },
    risks: facts.risks.validated.map((r) => ({
      description: r.description,
      agentType: r.agentType,
    })),
    procedures: {
      clinical: { performedAt: facts.exam.performedAt },
      complementary: [...facts.procedures]
        .sort(
          (a, b) =>
            a.performedAt.localeCompare(b.performedAt) ||
            a.procedureCode.localeCompare(b.procedureCode),
        )
        .map((p) => ({
          procedureCode: p.procedureCode,
          description: procedureLabel(p.procedureCode, p.otherDescription),
          performedAt: p.performedAt,
        })),
    },
    conclusion: {
      result: facts.exam.aptitude === "unfit" ? ("unfit" as const) : ("fit" as const),
      label:
        facts.exam.aptitude === "unfit" ? "Inapto para a função" : "Apto para a função",
      basis:
        "Conclusão registrada do médico examinador (MED-01). O sistema não conclui aptidão.",
    },
    coordinator: facts.coordinator,
    examiner: {
      name: facts.examiner?.name ?? "",
      registration: facts.examiner?.registration ?? "",
      examDate: facts.exam.performedAt,
      signature: {
        status: "pending" as const,
        note: "Assinatura do médico examinador pendente: não há mecanismo de assinatura verificável no sistema (MED-12).",
      },
    },
    warnings: readiness
      .filter((i) => i.severity === "warning")
      .map(({ code, message, reference }) => ({ code, message, reference })),
  };
}
export type AsoContent = ReturnType<typeof composeAso>;

export function asoContentHash(content: AsoContent): string {
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}
