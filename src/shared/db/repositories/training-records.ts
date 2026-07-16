import "server-only";

import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";

import {
  computeValidUntil,
  type TrainingRecordValues,
} from "@/shared/domains/pgr/trainings";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  employees,
  trainingCatalog,
  trainingRecords,
  type TrainingRecord,
} from "../schema";
import { auditedTenantWrite } from "./audited-write";

export type ListTrainingRecordsParams = PageParams & { employeeId: string };

/** Linha do histórico por funcionário (junta o nome/periodicidade do catálogo). */
export type TrainingRecordRow = TrainingRecord & {
  trainingName: string;
  periodicity: (typeof trainingCatalog.$inferSelect)["periodicity"];
};

const AUDIT_OP = "pgr.training_records.write_rejected";

/** Garante que o funcionário existe DENTRO do tenant (senão FK_NOT_FOUND). */
async function assertEmployeeInTenant(
  tx: TenantTransaction,
  orgId: string,
  employeeId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("employee");
}

export async function listTrainingRecordsByEmployee(
  orgId: string,
  params: ListTrainingRecordsParams,
): Promise<Paginated<TrainingRecordRow>> {
  const { limit, offset } = resolvePageParams(params);
  const where = and(
    eq(trainingRecords.orgId, orgId),
    eq(trainingRecords.employeeId, params.employeeId),
  );

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        ...getTableColumns(trainingRecords),
        trainingName: trainingCatalog.name,
        periodicity: trainingCatalog.periodicity,
      })
      .from(trainingRecords)
      .innerJoin(trainingCatalog, eq(trainingRecords.trainingId, trainingCatalog.id))
      .where(where)
      .orderBy(desc(trainingRecords.completedAt), desc(trainingRecords.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(trainingRecords)
      .where(where);
    return { rows, total };
  });
}

export async function getTrainingRecordById(
  orgId: string,
  id: string,
): Promise<TrainingRecord | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(trainingRecords)
      .where(and(eq(trainingRecords.orgId, orgId), eq(trainingRecords.id, id)))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Grava uma realização numa única transação: valida funcionário e treinamento
 * DENTRO do tenant (cross-tenant → FK_NOT_FOUND; a FK do banco não enxerga
 * `org_id`) e calcula `valid_until` NO SERVIDOR via D1 pela periodicidade
 * vigente do catálogo (`single → null`), persistindo o valor (D6). Compartilhado
 * pela Server Action e pelo REST mirror — a regra vive só aqui.
 */
export async function createTrainingRecord(
  orgId: string,
  input: TrainingRecordValues,
): Promise<TrainingRecord> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertEmployeeInTenant(tx, orgId, input.employeeId);

      const [training] = await tx
        .select({ periodicity: trainingCatalog.periodicity })
        .from(trainingCatalog)
        .where(
          and(eq(trainingCatalog.orgId, orgId), eq(trainingCatalog.id, input.trainingId)),
        )
        .limit(1);
      if (!training) throw new ReferenceNotFoundError("training");

      const validUntil = computeValidUntil(input.completedAt, training.periodicity);
      const [row] = await tx
        .insert(trainingRecords)
        .values({
          orgId,
          employeeId: input.employeeId,
          trainingId: input.trainingId,
          completedAt: input.completedAt,
          validUntil,
          certificatePath: input.certificatePath ?? null,
        })
        .returning();
      return row;
    }),
  );
}

export async function deleteTrainingRecord(
  orgId: string,
  id: string,
): Promise<TrainingRecord | null> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .delete(trainingRecords)
        .where(and(eq(trainingRecords.orgId, orgId), eq(trainingRecords.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}
