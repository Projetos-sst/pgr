import {
  classifyDocumentValidity,
  type DocumentValidityStatus,
} from "@/shared/domains/documents/validity";

/**
 * Rótulos da validade INFORMADA do exame (`valid_until`). Nenhuma periodicidade é
 * calculada: "Sem validade informada" é o exame sem data de vencimento.
 */
export const EXAM_VALIDITY_LABELS: Record<DocumentValidityStatus, string> = {
  ok: "Vigente",
  due_soon: "A vencer",
  expired: "Vencido",
  no_expiry: "Sem validade informada",
};

export type ExamValidityCounts = {
  ok: number;
  dueSoon: number;
  expired: number;
  noExpiry: number;
  withoutExam: number;
};

export type MedicineCompanySummary = {
  companyId: string;
  companyName: string;
  employeeCount: number;
  validity: ExamValidityCounts;
};

export type MedicineOverview = {
  today: string;
  dueWindowDays: number;
  companies: MedicineCompanySummary[];
  totals: { companies: number; employees: number } & ExamValidityCounts;
};

/** Fotografia do painel lida do banco (empresas com Medicina habilitada). */
export type MedicineOverviewData = {
  companies: { id: string; razaoSocial: string }[];
  employeeCounts: { companyId: string; count: number }[];
  /** Um item por funcionário com exame: o exame mais recente dele. */
  latestExams: { companyId: string; validUntil: string | null }[];
};

const VALIDITY_KEY: Record<
  DocumentValidityStatus,
  keyof Omit<ExamValidityCounts, "withoutExam">
> = {
  ok: "ok",
  due_soon: "dueSoon",
  expired: "expired",
  no_expiry: "noExpiry",
};

function emptyCounts(): ExamValidityCounts {
  return { ok: 0, dueSoon: 0, expired: 0, noExpiry: 0, withoutExam: 0 };
}

/**
 * Resumo do painel da Medicina: conta a situação do ÚLTIMO exame de cada
 * funcionário (não todos os exames — exame antigo superado não conta), classificada
 * por `classifyDocumentValidity` (mesmas fronteiras do badge). `withoutExam` =
 * funcionários − funcionários com exame (nunca negativo). Empresa sem funcionários
 * aparece com zeros; empresas ordenadas por razão social. Exame de empresa fora da
 * lista (sem Medicina) é ignorado.
 */
export function summarizeMedicineOverview(
  data: MedicineOverviewData,
  opts: { today: string; dueWindowDays: number },
): MedicineOverview {
  const employeeCountByCompany = new Map<string, number>();
  for (const row of data.employeeCounts)
    employeeCountByCompany.set(
      row.companyId,
      (employeeCountByCompany.get(row.companyId) ?? 0) + row.count,
    );

  const countsByCompany = new Map<string, ExamValidityCounts>();
  const withExamByCompany = new Map<string, number>();
  for (const company of data.companies) {
    countsByCompany.set(company.id, emptyCounts());
    withExamByCompany.set(company.id, 0);
  }
  for (const exam of data.latestExams) {
    const counts = countsByCompany.get(exam.companyId);
    if (!counts) continue;
    const validity = classifyDocumentValidity(exam.validUntil, opts);
    counts[VALIDITY_KEY[validity]] += 1;
    withExamByCompany.set(
      exam.companyId,
      (withExamByCompany.get(exam.companyId) ?? 0) + 1,
    );
  }

  const companies: MedicineCompanySummary[] = [...data.companies]
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"))
    .map((company) => {
      const employeeCount = employeeCountByCompany.get(company.id) ?? 0;
      const validity = countsByCompany.get(company.id) ?? emptyCounts();
      const withExam = withExamByCompany.get(company.id) ?? 0;
      return {
        companyId: company.id,
        companyName: company.razaoSocial,
        employeeCount,
        validity: { ...validity, withoutExam: Math.max(0, employeeCount - withExam) },
      };
    });

  const totals = companies.reduce(
    (acc, company) => ({
      companies: acc.companies + 1,
      employees: acc.employees + company.employeeCount,
      ok: acc.ok + company.validity.ok,
      dueSoon: acc.dueSoon + company.validity.dueSoon,
      expired: acc.expired + company.validity.expired,
      noExpiry: acc.noExpiry + company.validity.noExpiry,
      withoutExam: acc.withoutExam + company.validity.withoutExam,
    }),
    { companies: 0, employees: 0, ...emptyCounts() },
  );

  return {
    today: opts.today,
    dueWindowDays: opts.dueWindowDays,
    companies,
    totals,
  };
}
