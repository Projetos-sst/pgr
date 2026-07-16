import "server-only";

import { and, asc, eq, isNotNull, sql, type SQL } from "drizzle-orm";

import { todayInSaoPaulo } from "@/shared/dates";
import {
  classifyTrainingStatus,
  statusForDueWindow,
  type TrainingDueSummary,
  type TrainingStatusRow,
} from "@/shared/domains/pgr/trainings";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  employees,
  jobRoleRequiredTrainings,
  trainingCatalog,
  trainingRecords,
} from "../schema";

export type ListTrainingExpiryParams = {
  employeeId?: string;
  /** Janela em dias (30/60/90) — repassada verbatim ao `dueWindowDays` de D2. */
  dueWithinDays: number;
};

/**
 * Helper D5 — último registro por (funcionário, treinamento):
 * `ROW_NUMBER() OVER (PARTITION BY employee_id, training_id ORDER BY
 * completed_at DESC)`, consumindo só `rn = 1`. Reciclagem gera linhas novas;
 * apenas a mais recente conta para vencimento (US3) e conformidade (US4).
 */
function latestRecordsSubquery(
  tx: TenantTransaction,
  orgId: string,
  employeeId?: string,
) {
  const rn =
    sql<number>`row_number() over (partition by ${trainingRecords.employeeId}, ${trainingRecords.trainingId} order by ${trainingRecords.completedAt} desc, ${trainingRecords.createdAt} desc)`.as(
      "rn",
    );
  const filters: SQL[] = [eq(trainingRecords.orgId, orgId)];
  if (employeeId) filters.push(eq(trainingRecords.employeeId, employeeId));
  return tx
    .select({
      employeeId: trainingRecords.employeeId,
      trainingId: trainingRecords.trainingId,
      completedAt: trainingRecords.completedAt,
      validUntil: trainingRecords.validUntil,
      rn,
    })
    .from(trainingRecords)
    .where(and(...filters))
    .as("latest");
}

/**
 * Controle de vencimento (US3): último registro por par (D5) com
 * `valid_until` — `single` (`valid_until IS NULL`) fica FORA do cômputo —
 * classificado por D2 no fuso America/Sao_Paulo. Ordena pelos vencimentos mais
 * próximos (vencidos primeiro).
 */
export async function listTrainingExpiry(
  orgId: string,
  params: ListTrainingExpiryParams,
): Promise<TrainingStatusRow[]> {
  return withOrg(orgId, async (tx) => {
    const latest = latestRecordsSubquery(tx, orgId, params.employeeId);
    const rows = await tx
      .select({
        employeeId: latest.employeeId,
        employeeName: employees.fullName,
        trainingId: latest.trainingId,
        trainingName: trainingCatalog.name,
        completedAt: latest.completedAt,
        validUntil: latest.validUntil,
      })
      .from(latest)
      .innerJoin(
        employees,
        and(eq(employees.id, latest.employeeId), eq(employees.orgId, orgId)),
      )
      .innerJoin(
        trainingCatalog,
        and(eq(trainingCatalog.id, latest.trainingId), eq(trainingCatalog.orgId, orgId)),
      )
      .where(and(eq(latest.rn, 1), isNotNull(latest.validUntil)))
      .orderBy(asc(latest.validUntil), asc(employees.fullName));

    const today = todayInSaoPaulo();
    return rows.map((row) => ({
      ...row,
      status: statusForDueWindow(row.validUntil, {
        today,
        dueWithinDays: params.dueWithinDays,
      }),
    }));
  });
}

const COMPLIANCE_DUE_WINDOW_DAYS = 30;

type ComplianceJoinedRow = {
  employeeId: string;
  employeeName: string;
  trainingId: string;
  trainingName: string;
  completedAt: string | null;
  validUntil: string | null;
};

/**
 * Um obrigatório é classificado por D2 sobre o ÚLTIMO registro do par (D5):
 * sem registro (`completedAt` null, left join sem match) → `missing`; registro
 * de treinamento `single` (`validUntil` null) → `ok`. Janela fixa de 30 dias.
 */
function classifyComplianceRow(row: ComplianceJoinedRow, today: string) {
  return classifyTrainingStatus(
    row.completedAt !== null ? { validUntil: row.validUntil } : null,
    { today, dueWindowDays: COMPLIANCE_DUE_WINDOW_DAYS },
  );
}

/**
 * Conformidade de UM funcionário (US4): para cada treinamento obrigatório da
 * função dele, o status do último registro. Funcionário sem função
 * (`job_role_id` null) ou função sem obrigatórios → lista vazia (conforme por
 * vacuidade). Funcionário inexistente/cross-tenant → NOT_FOUND.
 */
export async function getEmployeeCompliance(
  orgId: string,
  employeeId: string,
): Promise<TrainingStatusRow[]> {
  return withOrg(orgId, async (tx) => {
    const [employee] = await tx
      .select({
        id: employees.id,
        fullName: employees.fullName,
        jobRoleId: employees.jobRoleId,
      })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
      .limit(1);
    if (!employee) throw new NotFoundError();
    if (!employee.jobRoleId) return [];

    const latest = latestRecordsSubquery(tx, orgId, employeeId);
    const rows = await tx
      .select({
        trainingId: jobRoleRequiredTrainings.trainingId,
        trainingName: trainingCatalog.name,
        completedAt: latest.completedAt,
        validUntil: latest.validUntil,
      })
      .from(jobRoleRequiredTrainings)
      .innerJoin(
        trainingCatalog,
        and(
          eq(trainingCatalog.id, jobRoleRequiredTrainings.trainingId),
          eq(trainingCatalog.orgId, orgId),
        ),
      )
      .leftJoin(
        latest,
        and(eq(latest.trainingId, jobRoleRequiredTrainings.trainingId), eq(latest.rn, 1)),
      )
      .where(
        and(
          eq(jobRoleRequiredTrainings.orgId, orgId),
          eq(jobRoleRequiredTrainings.jobRoleId, employee.jobRoleId),
        ),
      )
      .orderBy(asc(trainingCatalog.name));

    const today = todayInSaoPaulo();
    return rows.map((row) => {
      const joined: ComplianceJoinedRow = {
        ...row,
        employeeId: employee.id,
        employeeName: employee.fullName,
      };
      return { ...joined, status: classifyComplianceRow(joined, today) };
    });
  });
}

/**
 * Relatório de não-conformes (US4): mesma regra da conformidade por
 * funcionário, sem filtro — devolve apenas linhas `missing` ou `expired` de
 * todos os funcionários com função que tenha obrigatórios.
 */
export async function listNonCompliance(orgId: string): Promise<TrainingStatusRow[]> {
  return withOrg(orgId, async (tx) => {
    const latest = latestRecordsSubquery(tx, orgId);
    const rows = await tx
      .select({
        employeeId: employees.id,
        employeeName: employees.fullName,
        trainingId: jobRoleRequiredTrainings.trainingId,
        trainingName: trainingCatalog.name,
        completedAt: latest.completedAt,
        validUntil: latest.validUntil,
      })
      .from(employees)
      .innerJoin(
        jobRoleRequiredTrainings,
        and(
          eq(jobRoleRequiredTrainings.jobRoleId, employees.jobRoleId),
          eq(jobRoleRequiredTrainings.orgId, orgId),
        ),
      )
      .innerJoin(
        trainingCatalog,
        and(
          eq(trainingCatalog.id, jobRoleRequiredTrainings.trainingId),
          eq(trainingCatalog.orgId, orgId),
        ),
      )
      .leftJoin(
        latest,
        and(
          eq(latest.employeeId, employees.id),
          eq(latest.trainingId, jobRoleRequiredTrainings.trainingId),
          eq(latest.rn, 1),
        ),
      )
      .where(eq(employees.orgId, orgId))
      .orderBy(asc(employees.fullName), asc(trainingCatalog.name));

    const today = todayInSaoPaulo();
    return rows
      .map((row) => ({ ...row, status: classifyComplianceRow(row, today) }))
      .filter((row) => row.status === "missing" || row.status === "expired");
  });
}

const SUMMARY_DUE_WINDOW_DAYS = 30;

/**
 * Resumo `{expired, dueSoon}` para o dashboard (US3, D7 — sem cron/notificação).
 * Janela fixa de 30 dias para "a vencer".
 */
export async function getTrainingDueSummary(orgId: string): Promise<TrainingDueSummary> {
  const rows = await listTrainingExpiry(orgId, {
    dueWithinDays: SUMMARY_DUE_WINDOW_DAYS,
  });
  return {
    expired: rows.filter((row) => row.status === "expired").length,
    dueSoon: rows.filter((row) => row.status === "due_soon").length,
  };
}
