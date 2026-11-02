import "server-only";

import { and, between, desc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type {
  CatType,
  ClinicalExamRow,
  ProcedureRow,
} from "@/shared/domains/medicine/analytical-report";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { accidents } from "../schema/accidents";
import { companies } from "../schema/companies";
import { employees } from "../schema/employees";
import { healthExamProcedures, healthExams } from "../schema/health-exams";
import { medicos, type Medico } from "../schema/medicos";
import {
  pcmsoAnalyticalReports as reports,
  type PcmsoAnalyticalReport,
} from "../schema/pcmso-analytical-reports";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import { assertActorIsCompanyCoordinator } from "./medico-user-links";

export type AnalyticalReportSummary = Omit<PcmsoAnalyticalReport, "content">;

async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

async function findCompany(tx: TenantTransaction, orgId: string, companyId: string) {
  const [company] = await tx
    .select({
      razaoSocial: companies.razaoSocial,
      cnpj: companies.cnpj,
      riskGrade: companies.riskGrade,
    })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!company) throw new NotFoundError();
  await assertCompanyModuleTx(tx, orgId, companyId, "medicine");
  return company;
}

export type AnalyticalReportData = {
  company: { razaoSocial: string; cnpj: string | null; riskGrade: number | null };
  employees: number;
  clinicalRows: ClinicalExamRow[];
  unverifiedOrigin: number;
  procedureRows: ProcedureRow[];
  catRows: { type: CatType }[];
  catsWithoutIssueDate: number;
};

/**
 * Dados reais do período, só consolidáveis: nenhum nome, CPF ou observação sai daqui. Exames
 * clínicos e complementares contam pela empresa onde foram realizados (MED-07); exames sem origem
 * comprovada são contados à parte, nunca atribuídos.
 */
export async function loadAnalyticalReportData(
  ctx: TenantContext,
  companyId: string,
  period: { periodStart: string; periodEnd: string },
): Promise<AnalyticalReportData> {
  return actorTx(ctx, async (tx) => {
    const company = await findCompany(tx, ctx.tenantId, companyId);
    const [{ headcount }] = await tx
      .select({ headcount: sql<number>`count(*)::int` })
      .from(employees)
      .where(
        and(
          eq(employees.orgId, ctx.tenantId),
          eq(employees.companyId, companyId),
          inArray(employees.status, ["active", "on_leave"]),
        ),
      );
    const inPeriod = between(
      healthExams.performedAt,
      period.periodStart,
      period.periodEnd,
    );
    const clinicalRows = await tx
      .select({
        employeeId: healthExams.employeeId,
        examType: healthExams.examType,
        performedAt: healthExams.performedAt,
      })
      .from(healthExams)
      .where(
        and(
          eq(healthExams.orgId, ctx.tenantId),
          eq(healthExams.companyId, companyId),
          inPeriod,
        ),
      );
    const [{ unverified }] = await tx
      .select({ unverified: sql<number>`count(*)::int` })
      .from(healthExams)
      .innerJoin(
        employees,
        and(
          eq(employees.id, healthExams.employeeId),
          eq(employees.orgId, healthExams.orgId),
        ),
      )
      .where(
        and(
          eq(healthExams.orgId, ctx.tenantId),
          isNull(healthExams.companyId),
          eq(employees.companyId, companyId),
          inPeriod,
        ),
      );
    const procedureRows = await tx
      .select({
        procedureCode: healthExamProcedures.procedureCode,
        otherDescription: healthExamProcedures.otherDescription,
      })
      .from(healthExamProcedures)
      .where(
        and(
          eq(healthExamProcedures.orgId, ctx.tenantId),
          eq(healthExamProcedures.companyId, companyId),
          between(healthExamProcedures.performedAt, period.periodStart, period.periodEnd),
        ),
      );
    // CAT: só número registrado, sem cancelados; nada além do tipo é lido (dado de saúde P0).
    const catBase = and(
      eq(accidents.orgId, ctx.tenantId),
      eq(accidents.companyId, companyId),
      ne(accidents.status, "cancelled"),
      sql`nullif(btrim(${accidents.catNumber}), '') is not null`,
    );
    const catRows = await tx
      .select({ type: accidents.type })
      .from(accidents)
      .where(
        and(
          catBase,
          between(accidents.catIssuedAt, period.periodStart, period.periodEnd),
        ),
      );
    const [{ withoutDate }] = await tx
      .select({ withoutDate: sql<number>`count(*)::int` })
      .from(accidents)
      .where(
        and(
          catBase,
          isNull(accidents.catIssuedAt),
          sql`(${accidents.occurredAt} at time zone 'America/Sao_Paulo')::date between ${period.periodStart}::date and ${period.periodEnd}::date`,
        ),
      );
    return {
      company,
      employees: headcount,
      clinicalRows,
      unverifiedOrigin: unverified,
      procedureRows,
      catRows,
      catsWithoutIssueDate: withoutDate,
    };
  });
}

/** Médico coordenador da conta da sessão (vínculo + designação aberta); senão, FORBIDDEN. */
export async function getActorCoordinator(
  ctx: TenantContext,
  companyId: string,
): Promise<Medico> {
  return actorTx(ctx, async (tx) => {
    await findCompany(tx, ctx.tenantId, companyId);
    const { medicoId } = await assertActorIsCompanyCoordinator(tx, ctx, companyId);
    const [medico] = await tx
      .select()
      .from(medicos)
      .where(and(eq(medicos.orgId, ctx.tenantId), eq(medicos.id, medicoId)))
      .limit(1);
    if (!medico) throw new NotFoundError();
    return medico;
  });
}

const summary = {
  id: reports.id,
  orgId: reports.orgId,
  companyId: reports.companyId,
  version: reports.version,
  status: reports.status,
  periodStart: reports.periodStart,
  periodEnd: reports.periodEnd,
  previousReportId: reports.previousReportId,
  contentSha256: reports.contentSha256,
  authoredByMedicoId: reports.authoredByMedicoId,
  generatedBy: reports.generatedBy,
  generatedAt: reports.generatedAt,
};

/** Versões da empresa, da mais recente à mais antiga (sem o conteúdo). */
export async function listAnalyticalReports(
  ctx: TenantContext,
  companyId: string,
): Promise<AnalyticalReportSummary[]> {
  return actorTx(ctx, async (tx) => {
    await findCompany(tx, ctx.tenantId, companyId);
    return tx
      .select(summary)
      .from(reports)
      .where(and(eq(reports.orgId, ctx.tenantId), eq(reports.companyId, companyId)))
      .orderBy(desc(reports.version));
  });
}

export async function getAnalyticalReport(
  ctx: TenantContext,
  id: string,
): Promise<PcmsoAnalyticalReport> {
  return actorTx(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.orgId, ctx.tenantId), eq(reports.id, id)))
      .limit(1);
    if (!row) throw new NotFoundError();
    await assertCompanyModuleTx(tx, ctx.tenantId, row.companyId, "medicine");
    return row;
  });
}

/** Último relatório (maior fim de período; empate pela versão mais nova), com o conteúdo. */
export async function getLatestAnalyticalReport(
  ctx: TenantContext,
  companyId: string,
): Promise<PcmsoAnalyticalReport | null> {
  return actorTx(ctx, async (tx) => {
    await findCompany(tx, ctx.tenantId, companyId);
    const [row] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.orgId, ctx.tenantId), eq(reports.companyId, companyId)))
      .orderBy(desc(reports.periodEnd), desc(reports.version))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Arquiva uma versão (imutável). Confere de novo o vínculo do coordenador na mesma transação; a
 * RLS exige o mesmo. A versão é sequencial por empresa.
 */
export async function insertAnalyticalReport(
  ctx: TenantContext,
  companyId: string,
  input: {
    periodStart: string;
    periodEnd: string;
    previousReportId: string | null;
    content: unknown;
    contentSha256: string;
  },
): Promise<AnalyticalReportSummary> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.analytical_reports.generate_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        await findCompany(tx, ctx.tenantId, companyId);
        const { medicoId } = await assertActorIsCompanyCoordinator(tx, ctx, companyId);
        const [{ last }] = await tx
          .select({ last: max(reports.version) })
          .from(reports)
          .where(and(eq(reports.orgId, ctx.tenantId), eq(reports.companyId, companyId)));
        const [created] = await tx
          .insert(reports)
          .values({
            orgId: ctx.tenantId,
            companyId,
            version: (last ?? 0) + 1,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            previousReportId: input.previousReportId,
            content: input.content,
            contentSha256: input.contentSha256,
            authoredByMedicoId: medicoId,
            generatedBy: ctx.userId,
          })
          .returning(summary);
        return created;
      }),
  );
}
