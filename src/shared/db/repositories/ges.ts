import "server-only";

import { and, eq, sql } from "drizzle-orm";

import {
  resolveExposedTotal,
  buildExposedWorkersMap,
} from "@/shared/domains/pgr/exposed-workers";

import { withOrg } from "../with-org";
import { ges, type Ges } from "../schema/ges";
import { gesJobRoles } from "../schema/ges-job-roles";
import { auditedTenantWrite } from "./audited-write";

export type NewGesInput = {
  companyId: string;
  workUnitId: string;
  name: string;
  processDescription?: string | null;
  constructionType?: string | null;
  ceilingHeight?: string | null;
  floor?: string | null;
  roof?: string | null;
  lighting?: string | null;
  ventilation?: string | null;
  otherCharacteristics?: string | null;
};

export async function listGes(orgId: string): Promise<Ges[]> {
  return withOrg(orgId, (tx) => tx.select().from(ges).where(eq(ges.orgId, orgId)));
}

export async function createGes(orgId: string, input: NewGesInput): Promise<Ges> {
  return auditedTenantWrite(orgId, "pgr.ges.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(ges)
        .values({ ...input, orgId })
        .returning();
      return row;
    }),
  );
}

export async function countExposedWorkersByGes(
  orgId: string,
  gesId: string,
): Promise<number> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        total: sql<number>`coalesce(sum(${gesJobRoles.workerCount}), 0)::int`,
      })
      .from(gesJobRoles)
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, gesId)));
    return resolveExposedTotal(row);
  });
}

export async function exposedWorkersByGesMap(
  orgId: string,
): Promise<Record<string, number>> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        gesId: ges.id,
        total: sql<number>`coalesce(sum(${gesJobRoles.workerCount}), 0)::int`,
      })
      .from(ges)
      .leftJoin(gesJobRoles, eq(gesJobRoles.gesId, ges.id))
      .where(eq(ges.orgId, orgId))
      .groupBy(ges.id);
    return buildExposedWorkersMap(rows);
  });
}
