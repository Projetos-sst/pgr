import "server-only";

import { and, between, desc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type {
  CatType,
  ClinicalExamRow,
  ProcedureRow,
} from "@/shared/domains/medicine/analytical-report";
import {
  chronologyProblem,
  effectiveReportEventIds,
  type ReportEventInput,
} from "@/shared/domains/medicine/analytical-report-presentation";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { accidents } from "../schema/accidents";
import { companies } from "../schema/companies";
import { employees } from "../schema/employees";
import { healthExamProcedures, healthExams } from "../schema/health-exams";
import { medicos, type Medico } from "../schema/medicos";
import {
  pcmsoAnalyticalReportEvents as reportEvents,
  pcmsoAnalyticalReports as reports,
  type PcmsoAnalyticalReport,
  type PcmsoAnalyticalReportEvent,
} from "../schema/pcmso-analytical-reports";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import { assertActorIsCompanyCoordinator } from "./medico-user-links";
import { dateInSaoPaulo } from "@/shared/dates";

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

/** Coordenador da conta da sessão (vínculo + designação em vigor hoje); senão, FORBIDDEN. */
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

// ── Finalização, apresentação e discussão (NOB-168; NR-7 7.6.5) ─────────────────

export type ReportEventItem = Omit<PcmsoAnalyticalReportEvent, "recordedAt"> & {
  recordedAt: string;
};
const toEventItem = (row: PcmsoAnalyticalReportEvent): ReportEventItem => ({
  ...row,
  recordedAt: row.recordedAt.toISOString(),
});

/** Eventos de todas as versões da empresa e a versão vigente (a mais recente). */
export async function listReportEvents(ctx: TenantContext, companyId: string) {
  return actorTx(ctx, async (tx) => {
    await findCompany(tx, ctx.tenantId, companyId);
    const [current] = await tx
      .select(summary)
      .from(reports)
      .where(and(eq(reports.orgId, ctx.tenantId), eq(reports.companyId, companyId)))
      .orderBy(desc(reports.version))
      .limit(1);
    const rows = await tx
      .select()
      .from(reportEvents)
      .where(
        and(eq(reportEvents.orgId, ctx.tenantId), eq(reportEvents.companyId, companyId)),
      )
      .orderBy(reportEvents.recordedAt);
    return { current: current ?? null, events: rows.map(toEventItem) };
  });
}

/** Eventos com efeito do relatório (não corrigidos e com o ato de base também com efeito). */
async function effectiveEventsTx(tx: TenantTransaction, orgId: string, reportId: string) {
  const rows = await tx
    .select({
      id: reportEvents.id,
      reportId: reportEvents.reportId,
      kind: reportEvents.kind,
      cipaSituation: reportEvents.cipaSituation,
      basisId: reportEvents.basisId,
      voidsId: reportEvents.voidsId,
      occurredOn: reportEvents.occurredOn,
      recordedAt: reportEvents.recordedAt,
    })
    .from(reportEvents)
    .where(and(eq(reportEvents.orgId, orgId), eq(reportEvents.reportId, reportId)));
  const ids = effectiveReportEventIds(
    rows.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() })),
  );
  return rows.filter((r) => ids.has(r.id));
}

/** Data civil (YYYY-MM-DD) de um instante no fuso America/Sao_Paulo. */
const saoPauloDate = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(at);

function eventRejected(error: unknown): never {
  const code = (error as { cause?: { code?: string } }).cause?.code;
  if (code === "42501")
    throw new ForbiddenError(
      "Registro recusado pelo banco: confira a versão vigente, a finalização pelo médico responsável e o seu perfil.",
    );
  if (code === "23505") throw new ValidationError("Este registro já foi corrigido.");
  throw error;
}

/**
 * Registra finalização, apresentação ou discussão da versão **vigente** do relatório. A versão e o
 * hash vêm do banco, não do cliente. Confere no servidor (e o banco confere de novo): finalização
 * só pelo médico responsável que elaborou a versão, verificado e ainda designado; apresentação só
 * de versão finalizada e não anterior ao dia da finalização; discussão só depois de apresentação e
 * não anterior à data dela; datas reais (não futuras). Cada ato guarda o ato de base (`basisId`).
 */
export async function insertReportEvent(
  ctx: TenantContext,
  reportId: string,
  input: ReportEventInput,
  checkDate: (reportGeneratedOn: string) => string | null,
): Promise<ReportEventItem> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.analytical_report_event.rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const [report] = await tx
          .select()
          .from(reports)
          .where(and(eq(reports.orgId, ctx.tenantId), eq(reports.id, reportId)))
          .limit(1);
        if (!report) throw new NotFoundError();
        await assertCompanyModuleTx(tx, ctx.tenantId, report.companyId, "medicine");
        // Serializa os registros do mesmo relatório (finalização e apresentação concorrentes).
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`analytical-report-events:${report.id}`}, 0))`,
        );
        const [{ last }] = await tx
          .select({ last: max(reports.version) })
          .from(reports)
          .where(
            and(eq(reports.orgId, ctx.tenantId), eq(reports.companyId, report.companyId)),
          );
        if (report.version !== last)
          throw new ValidationError(
            "Há versão mais recente do relatório: registre a finalização, a apresentação e a discussão da versão vigente.",
          );
        const effective = await effectiveEventsTx(tx, ctx.tenantId, report.id);
        const finalization = effective.find((e) => e.kind === "finalized");
        let basisId: string | null = null;
        if (input.kind === "finalized") {
          if (finalization) throw new ValidationError("Esta versão já está finalizada.");
          const { medicoId } = await assertActorIsCompanyCoordinator(
            tx,
            ctx,
            report.companyId,
          );
          if (medicoId !== report.authoredByMedicoId)
            throw new ForbiddenError(
              "Só o médico responsável que elaborou esta versão a finaliza.",
            );
        } else {
          if (!finalization)
            throw new ValidationError(
              "A versão ainda não foi finalizada pelo médico responsável: a prévia não é apresentada.",
            );
          // Discussão apoia-se na apresentação vigente mais recente (data, depois registro).
          const presentation = effective
            .filter((e) => e.kind === "presented")
            .sort(
              (a, b) =>
                (a.occurredOn ?? "").localeCompare(b.occurredOn ?? "") ||
                a.recordedAt.getTime() - b.recordedAt.getTime(),
            )
            .at(-1);
          if (input.kind === "discussed" && !presentation)
            throw new ValidationError("Registre antes a apresentação do relatório.");
          const problem =
            checkDate(dateInSaoPaulo(report.generatedAt) ?? "") ??
            (input.kind === "presented"
              ? chronologyProblem(
                  "presented",
                  input.occurredOn,
                  saoPauloDate(finalization.recordedAt),
                )
              : chronologyProblem(
                  "discussed",
                  input.occurredOn,
                  presentation!.occurredOn!,
                ));
          if (problem) throw new ValidationError(problem);
          basisId = input.kind === "presented" ? finalization.id : presentation!.id;
        }
        const base = {
          orgId: ctx.tenantId,
          companyId: report.companyId,
          reportId: report.id,
          reportSha256: report.contentSha256,
          recordedBy: ctx.userId,
        };
        const values =
          input.kind === "finalized"
            ? { ...base, kind: "finalized" as const, note: input.note }
            : input.kind === "presented"
              ? {
                  ...base,
                  kind: "presented" as const,
                  basisId,
                  occurredOn: input.occurredOn,
                  modality: input.modality,
                  participants: input.participants,
                  cipaSituation: input.cipaSituation,
                  cipaReference: input.cipaReference,
                  evidenceReference: input.evidenceReference,
                }
              : {
                  ...base,
                  kind: "discussed" as const,
                  basisId,
                  occurredOn: input.occurredOn,
                  participants: input.participants,
                  summary: input.summary,
                  measures: input.measures,
                  evidenceReference: input.evidenceReference,
                };
        try {
          const [row] = await tx.insert(reportEvents).values(values).returning();
          return toEventItem(row);
        } catch (error) {
          eventRejected(error);
        }
      }),
  );
}

/** Corrige um registro (com motivo); o original é preservado. Finalização: só o médico autor. */
export async function voidReportEvent(
  ctx: TenantContext,
  eventId: string,
  reason: string,
): Promise<ReportEventItem> {
  return auditedTenantWrite(
    ctx.tenantId,
    "medicine.analytical_report_event.void_rejected",
    () =>
      actorTx(ctx, async (tx) => {
        const [target] = await tx
          .select()
          .from(reportEvents)
          .where(and(eq(reportEvents.orgId, ctx.tenantId), eq(reportEvents.id, eventId)))
          .limit(1);
        if (!target) throw new NotFoundError();
        await assertCompanyModuleTx(tx, ctx.tenantId, target.companyId, "medicine");
        if (target.kind === "voided")
          throw new ValidationError(
            "Uma correção não é corrigida: registre o ato de novo.",
          );
        if (target.kind === "finalized") {
          const [report] = await tx
            .select({ author: reports.authoredByMedicoId })
            .from(reports)
            .where(and(eq(reports.orgId, ctx.tenantId), eq(reports.id, target.reportId)))
            .limit(1);
          const { medicoId } = await assertActorIsCompanyCoordinator(
            tx,
            ctx,
            target.companyId,
          );
          if (!report || report.author !== medicoId)
            throw new ForbiddenError("Só o médico responsável corrige a finalização.");
        }
        try {
          const [row] = await tx
            .insert(reportEvents)
            .values({
              orgId: ctx.tenantId,
              companyId: target.companyId,
              reportId: target.reportId,
              reportSha256: target.reportSha256,
              kind: "voided",
              voidsId: target.id,
              voidReason: reason,
              recordedBy: ctx.userId,
            })
            .returning();
          return toEventItem(row);
        } catch (error) {
          eventRejected(error);
        }
      }),
  );
}
