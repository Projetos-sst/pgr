import "server-only";

import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";

import {
  nextPsychosocialFactorNumber,
  type PsychosocialRiskFactorRow,
  type PsychosocialRiskFactorValues,
} from "@/shared/domains/psychosocial/risk-factors";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  ges,
  orgs,
  psychosocialRiskFactors,
  type PsychosocialRiskFactor,
} from "../schema";
import { auditedTenantWrite } from "./audited-write";

export type ListPsychosocialRiskFactorParams = PageParams & {
  search?: string;
  level?: string;
};

const AUDIT_OP = "psychosocial.risk_factors.write_rejected";

function toColumns(input: PsychosocialRiskFactorValues) {
  return {
    name: input.name,
    gesId: input.gesId,
    level: input.level,
    assessmentMethod: input.assessmentMethod ?? null,
    status: input.status,
    description: input.description ?? null,
  };
}

/** Valida que o GES pertence ao tenant (FK cross-tenant não é barrada por RLS). */
async function assertGesInTenant(
  tx: TenantTransaction,
  orgId: string,
  gesId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: ges.id })
    .from(ges)
    .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
}

export async function listPsychosocialRiskFactors(
  orgId: string,
  params: ListPsychosocialRiskFactorParams = {},
): Promise<Paginated<PsychosocialRiskFactorRow>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const level = params.level?.trim();
  const filters: SQL[] = [eq(psychosocialRiskFactors.orgId, orgId)];
  if (search) filters.push(ilike(psychosocialRiskFactors.name, `%${search}%`));
  if (level) filters.push(eq(psychosocialRiskFactors.level, level as never));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: psychosocialRiskFactors.id,
        orgId: psychosocialRiskFactors.orgId,
        number: psychosocialRiskFactors.number,
        name: psychosocialRiskFactors.name,
        gesId: psychosocialRiskFactors.gesId,
        level: psychosocialRiskFactors.level,
        assessmentMethod: psychosocialRiskFactors.assessmentMethod,
        status: psychosocialRiskFactors.status,
        description: psychosocialRiskFactors.description,
        createdAt: psychosocialRiskFactors.createdAt,
        updatedAt: psychosocialRiskFactors.updatedAt,
        gesName: ges.name,
      })
      .from(psychosocialRiskFactors)
      .leftJoin(ges, eq(ges.id, psychosocialRiskFactors.gesId))
      .where(where)
      .orderBy(asc(psychosocialRiskFactors.number))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(psychosocialRiskFactors)
      .where(where);
    return { rows, total };
  });
}

export async function getPsychosocialRiskFactorById(
  orgId: string,
  id: string,
): Promise<PsychosocialRiskFactor | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(psychosocialRiskFactors)
      .where(
        and(eq(psychosocialRiskFactors.orgId, orgId), eq(psychosocialRiskFactors.id, id)),
      )
      .limit(1);
    return row ?? null;
  });
}

export async function createPsychosocialRiskFactor(
  orgId: string,
  input: PsychosocialRiskFactorValues,
): Promise<PsychosocialRiskFactor> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertGesInTenant(tx, orgId, input.gesId);
      // Numeração sequencial por tenant sob lock da linha de orgs
      // (UNIQUE(org,number) é o backstop).
      await tx.execute(sql`select id from ${orgs} where id = ${orgId} for update`);
      const [{ max }] = await tx
        .select({ max: sql<number | null>`max(${psychosocialRiskFactors.number})` })
        .from(psychosocialRiskFactors)
        .where(eq(psychosocialRiskFactors.orgId, orgId));
      const number = nextPsychosocialFactorNumber(max);
      const [row] = await tx
        .insert(psychosocialRiskFactors)
        .values({ orgId, number, ...toColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updatePsychosocialRiskFactor(
  orgId: string,
  id: string,
  input: PsychosocialRiskFactorValues,
): Promise<PsychosocialRiskFactor | null> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertGesInTenant(tx, orgId, input.gesId);
      const [row] = await tx
        .update(psychosocialRiskFactors)
        .set({ ...toColumns(input), updatedAt: new Date() })
        .where(
          and(
            eq(psychosocialRiskFactors.orgId, orgId),
            eq(psychosocialRiskFactors.id, id),
          ),
        )
        .returning();
      return row ?? null;
    }),
  );
}

export async function deletePsychosocialRiskFactor(
  orgId: string,
  id: string,
): Promise<boolean> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(psychosocialRiskFactors)
        .where(
          and(
            eq(psychosocialRiskFactors.orgId, orgId),
            eq(psychosocialRiskFactors.id, id),
          ),
        )
        .returning({ id: psychosocialRiskFactors.id });
      return rows.length > 0;
    }),
  );
}
