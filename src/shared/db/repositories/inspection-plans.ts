import "server-only";

import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type {
  InspectionPlanValues,
  PlanListItem,
  PlanWithItems,
} from "@/shared/domains/inspections/plans";
import { toPlanListItem } from "@/shared/domains/inspections/plans";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { inspectionPlanItems, inspectionPlans } from "../schema";
import { withOrg } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "inspections.plans.write_rejected";

export type ListPlansParams = PageParams & { search?: string; type?: string };

// Subconsulta correlacionada: qualifica a coluna externa como
// "inspection_plans"."id" para não colidir com o "id" da tabela interna
// (Drizzle renderiza ${inspectionPlans.id} sem qualificar dentro do sql``).
const itemCountExpr = sql<number>`(
  select count(*)::int from inspection_plan_items ipi
  where ipi.plan_id = "inspection_plans"."id"
)`;

export async function listPlans(
  orgId: string,
  params: ListPlansParams = {},
): Promise<Paginated<PlanListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(inspectionPlans.orgId, orgId)];
  const search = params.search?.trim();
  if (search) filters.push(ilike(inspectionPlans.title, `%${search}%`));
  if (params.type) {
    filters.push(eq(inspectionPlans.type, params.type as "vehicular" | "equipment"));
  }
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: inspectionPlans.id,
        orgId: inspectionPlans.orgId,
        type: inspectionPlans.type,
        subtype: inspectionPlans.subtype,
        title: inspectionPlans.title,
        description: inspectionPlans.description,
        createdAt: inspectionPlans.createdAt,
        updatedAt: inspectionPlans.updatedAt,
        itemCount: itemCountExpr,
      })
      .from(inspectionPlans)
      .where(where)
      .orderBy(desc(inspectionPlans.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(inspectionPlans)
      .where(where);
    return { rows: rows.map(toPlanListItem), total };
  });
}

export async function getPlanWithItems(
  orgId: string,
  id: string,
): Promise<PlanWithItems | null> {
  return withOrg(orgId, async (tx) => {
    const [plan] = await tx
      .select()
      .from(inspectionPlans)
      .where(and(eq(inspectionPlans.orgId, orgId), eq(inspectionPlans.id, id)))
      .limit(1);
    if (!plan) return null;
    const items = await tx
      .select()
      .from(inspectionPlanItems)
      .where(
        and(eq(inspectionPlanItems.orgId, orgId), eq(inspectionPlanItems.planId, id)),
      )
      .orderBy(asc(inspectionPlanItems.order));
    return { plan, items };
  });
}

function itemRows(orgId: string, planId: string, items: InspectionPlanValues["items"]) {
  return items.map((item, index) => ({
    orgId,
    planId,
    description: item.description,
    defaultValue: item.defaultValue,
    order: index,
  }));
}

export async function createPlan(
  orgId: string,
  input: InspectionPlanValues,
): Promise<{ id: string }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [plan] = await tx
        .insert(inspectionPlans)
        .values({
          orgId,
          type: input.type,
          subtype: input.subtype ?? null,
          title: input.title,
          description: input.description ?? null,
        })
        .returning({ id: inspectionPlans.id });
      const rows = itemRows(orgId, plan.id, input.items);
      if (rows.length > 0) await tx.insert(inspectionPlanItems).values(rows);
      return { id: plan.id };
    }),
  );
}

export async function updatePlan(
  orgId: string,
  id: string,
  input: InspectionPlanValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [plan] = await tx
        .update(inspectionPlans)
        .set({
          type: input.type,
          subtype: input.subtype ?? null,
          title: input.title,
          description: input.description ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(inspectionPlans.orgId, orgId), eq(inspectionPlans.id, id)))
        .returning({ id: inspectionPlans.id });
      if (!plan) return false;
      await tx
        .delete(inspectionPlanItems)
        .where(
          and(eq(inspectionPlanItems.orgId, orgId), eq(inspectionPlanItems.planId, id)),
        );
      const rows = itemRows(orgId, id, input.items);
      if (rows.length > 0) await tx.insert(inspectionPlanItems).values(rows);
      return true;
    }),
  );
}

export async function deletePlan(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(inspectionPlans)
        .where(and(eq(inspectionPlans.orgId, orgId), eq(inspectionPlans.id, id)))
        .returning({ id: inspectionPlans.id });
      return rows.length > 0;
    }),
  );
}
