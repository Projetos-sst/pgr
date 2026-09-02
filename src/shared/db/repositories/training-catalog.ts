import "server-only";

import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type {
  TrainingCatalogOption,
  TrainingCatalogValues,
} from "@/shared/domains/pgr/trainings";
import { nextTrainingNumber } from "@/shared/domains/pgr/trainings";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  jobRoleRequiredTrainings,
  orgs,
  trainingCatalog,
  trainingRecords,
  type TrainingCatalog,
} from "../schema";
import { auditedTenantWrite } from "./audited-write";

export type ListTrainingCatalogParams = PageParams & { search?: string; norm?: string };

export type TrainingCatalogDependents = { records: number; requiredLinks: number };

const AUDIT_OP = "pgr.training_catalog.write_rejected";

function toTrainingCatalogColumns(input: TrainingCatalogValues) {
  return {
    name: input.name,
    referenceNorm: input.referenceNorm ?? null,
    workloadHours: input.workloadHours,
    periodicity: input.periodicity,
    isActive: input.isActive ?? true,
    description: input.description ?? null,
  };
}

/**
 * Walks the `cause` chain (postgres-js errors surfaced via Drizzle wrap the real
 * SQLSTATE on `error.cause.code`) looking for a foreign-key violation (23503).
 */
function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      if ((current as { code: unknown }).code === "23503") return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function listTrainingCatalog(
  orgId: string,
  params: ListTrainingCatalogParams = {},
): Promise<Paginated<TrainingCatalog>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const filters: SQL[] = [eq(trainingCatalog.orgId, orgId)];
  if (search) {
    const term = `%${search}%`;
    filters.push(
      or(ilike(trainingCatalog.name, term), ilike(trainingCatalog.referenceNorm, term))!,
    );
  }
  const norm = params.norm?.trim();
  if (norm) filters.push(eq(trainingCatalog.referenceNorm, norm));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(trainingCatalog)
      .where(where)
      .orderBy(asc(trainingCatalog.name))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(trainingCatalog)
      .where(where);
    return { rows, total };
  });
}

export type { TrainingCatalogOption };

export async function listTrainingCatalogOptions(
  orgId: string,
): Promise<TrainingCatalogOption[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select({
        id: trainingCatalog.id,
        name: trainingCatalog.name,
        periodicity: trainingCatalog.periodicity,
      })
      .from(trainingCatalog)
      .where(eq(trainingCatalog.orgId, orgId))
      .orderBy(asc(trainingCatalog.name)),
  );
}

export async function getTrainingCatalogById(
  orgId: string,
  id: string,
): Promise<TrainingCatalog | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(trainingCatalog)
      .where(and(eq(trainingCatalog.orgId, orgId), eq(trainingCatalog.id, id)))
      .limit(1);
    return row ?? null;
  });
}

/** Normas distintas do tenant — alimenta o filtro "Todas as NRs". */
export async function listTrainingNorms(orgId: string): Promise<string[]> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .selectDistinct({ norm: trainingCatalog.referenceNorm })
      .from(trainingCatalog)
      .where(eq(trainingCatalog.orgId, orgId))
      .orderBy(asc(trainingCatalog.referenceNorm));
    return rows.map((r) => r.norm).filter((n): n is string => !!n && n.trim() !== "");
  });
}

export async function createTrainingCatalog(
  orgId: string,
  input: TrainingCatalogValues,
): Promise<TrainingCatalog> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      // Numeração sequencial por tenant sob lock da linha de orgs (UNIQUE(org,number) backstop).
      await tx.execute(sql`select id from ${orgs} where id = ${orgId} for update`);
      const [{ max }] = await tx
        .select({ max: sql<number | null>`max(${trainingCatalog.number})` })
        .from(trainingCatalog)
        .where(eq(trainingCatalog.orgId, orgId));
      const number = nextTrainingNumber(max);
      const [row] = await tx
        .insert(trainingCatalog)
        .values({ orgId, number, ...toTrainingCatalogColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateTrainingCatalog(
  orgId: string,
  id: string,
  input: TrainingCatalogValues,
): Promise<TrainingCatalog | null> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(trainingCatalog)
        .set({ ...toTrainingCatalogColumns(input), updatedAt: new Date() })
        .where(and(eq(trainingCatalog.orgId, orgId), eq(trainingCatalog.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

async function countDependentsTx(
  tx: TenantTransaction,
  orgId: string,
  id: string,
): Promise<TrainingCatalogDependents> {
  const [{ total: records }] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(trainingRecords)
    .where(and(eq(trainingRecords.orgId, orgId), eq(trainingRecords.trainingId, id)));
  const [{ total: requiredLinks }] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(jobRoleRequiredTrainings)
    .where(
      and(
        eq(jobRoleRequiredTrainings.orgId, orgId),
        eq(jobRoleRequiredTrainings.trainingId, id),
      ),
    );
  return { records, requiredLinks };
}

/**
 * Exclusão atômica e defensiva: trava a linha (`FOR UPDATE`), conta dependentes
 * APÓS o lock e bloqueia com `EntityInUseError` se houver realização ou vínculo
 * de obrigatório. O `RESTRICT` do banco é backstop: 23503 → mesmo erro previsível.
 */
export async function deleteTrainingCatalog(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [locked] = await tx
        .select({ id: trainingCatalog.id })
        .from(trainingCatalog)
        .where(and(eq(trainingCatalog.orgId, orgId), eq(trainingCatalog.id, id)))
        .for("update")
        .limit(1);
      if (!locked) return false;

      const deps = await countDependentsTx(tx, orgId, id);
      if (deps.records + deps.requiredLinks > 0) {
        throw new EntityInUseError(
          "Treinamento em uso (realizações ou obrigatórios por função) e não pode ser excluído.",
        );
      }

      try {
        const rows = await tx
          .delete(trainingCatalog)
          .where(and(eq(trainingCatalog.orgId, orgId), eq(trainingCatalog.id, id)))
          .returning({ id: trainingCatalog.id });
        return rows.length > 0;
      } catch (error) {
        if (isForeignKeyViolation(error)) throw new EntityInUseError();
        throw error;
      }
    }),
  );
}

/** Contagem informativa de dependentes para a UI (sem lock). */
export async function countTrainingCatalogDependents(
  orgId: string,
  id: string,
): Promise<TrainingCatalogDependents> {
  return withOrg(orgId, (tx) => countDependentsTx(tx, orgId, id));
}
