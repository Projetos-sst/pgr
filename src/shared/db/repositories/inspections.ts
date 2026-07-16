import "server-only";

import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import {
  inspectionPlans,
  inspections,
  vehicles,
  type Inspection,
  type InspectionPlan,
  type Vehicle,
} from "../schema";
import { withOrg } from "../with-org";

/**
 * Consultas de base do módulo de inspeções (fatia 034 — modelo de dados). Todas
 * `withOrg` + filtro `org_id` explícito; as fatias de CRUD (veículos, planos,
 * inspeções) estendem com escrita. Retornam apenas registros do tenant ativo.
 */

const countExpr = sql<number>`count(*)::int`;

export async function listVehicles(
  orgId: string,
  params: PageParams = {},
): Promise<Paginated<Vehicle>> {
  const { limit, offset } = resolvePageParams(params);
  const where = eq(vehicles.orgId, orgId);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(vehicles)
      .where(where)
      .orderBy(desc(vehicles.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx.select({ total: countExpr }).from(vehicles).where(where);
    return { rows, total };
  });
}

export async function getVehicleById(orgId: string, id: string): Promise<Vehicle | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function listInspectionPlans(
  orgId: string,
  params: PageParams = {},
): Promise<Paginated<InspectionPlan>> {
  const { limit, offset } = resolvePageParams(params);
  const where = eq(inspectionPlans.orgId, orgId);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(inspectionPlans)
      .where(where)
      .orderBy(desc(inspectionPlans.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(inspectionPlans)
      .where(where);
    return { rows, total };
  });
}

export async function getInspectionPlanById(
  orgId: string,
  id: string,
): Promise<InspectionPlan | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(inspectionPlans)
      .where(and(eq(inspectionPlans.orgId, orgId), eq(inspectionPlans.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export type ListInspectionsParams = PageParams & { type?: string };

export async function listInspections(
  orgId: string,
  params: ListInspectionsParams = {},
): Promise<Paginated<Inspection>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(inspections.orgId, orgId)];
  if (params.type) {
    filters.push(eq(inspections.type, params.type as Inspection["type"]));
  }
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(inspections)
      .where(where)
      .orderBy(desc(inspections.inspectedAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(inspections)
      .where(where);
    return { rows, total };
  });
}

export async function getInspectionById(
  orgId: string,
  id: string,
): Promise<Inspection | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(inspections)
      .where(and(eq(inspections.orgId, orgId), eq(inspections.id, id)))
      .limit(1);
    return row ?? null;
  });
}
