import "server-only";

import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type {
  ChecklistValues,
  EquipmentInspectionDetail,
  EquipmentInspectionHeaderValues,
  EquipmentInspectionListItem,
} from "@/shared/domains/inspections/equipment-inspections";
import { toEquipmentInspectionListItem } from "@/shared/domains/inspections/equipment-inspections";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { epiCatalog } from "../schema";
import {
  inspectionItemResponses,
  inspectionPlanItems,
  inspectionPlans,
  inspections,
} from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "inspections.equipment.write_rejected";
const countExpr = sql<number>`count(*)::int`;

export type ListEquipmentInspectionsParams = PageParams & { status?: string };

export async function listEquipmentInspections(
  orgId: string,
  params: ListEquipmentInspectionsParams = {},
): Promise<Paginated<EquipmentInspectionListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [
    eq(inspections.orgId, orgId),
    eq(inspections.type, "equipment"),
  ];
  if (params.status) {
    filters.push(eq(inspections.status, params.status as "pending"));
  }
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: inspections.id,
        inspectedAt: inspections.inspectedAt,
        status: inspections.status,
        responsible: inspections.responsible,
        equipmentName: epiCatalog.name,
        planTitle: inspectionPlans.title,
      })
      .from(inspections)
      .leftJoin(epiCatalog, eq(epiCatalog.id, inspections.equipmentCatalogId))
      .leftJoin(inspectionPlans, eq(inspectionPlans.id, inspections.planId))
      .where(where)
      .orderBy(desc(inspections.inspectedAt), desc(inspections.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(inspections)
      .where(where);
    return { rows: rows.map(toEquipmentInspectionListItem), total };
  });
}

export async function getEquipmentInspection(
  orgId: string,
  id: string,
): Promise<EquipmentInspectionDetail | null> {
  return withOrg(orgId, async (tx) => {
    const [inspection] = await tx
      .select()
      .from(inspections)
      .where(
        and(
          eq(inspections.orgId, orgId),
          eq(inspections.id, id),
          eq(inspections.type, "equipment"),
        ),
      )
      .limit(1);
    if (!inspection) return null;

    const [equipment] = inspection.equipmentCatalogId
      ? await tx
          .select({ id: epiCatalog.id, name: epiCatalog.name })
          .from(epiCatalog)
          .where(eq(epiCatalog.id, inspection.equipmentCatalogId))
          .limit(1)
      : [];
    const [plan] = inspection.planId
      ? await tx
          .select({ id: inspectionPlans.id, title: inspectionPlans.title })
          .from(inspectionPlans)
          .where(eq(inspectionPlans.id, inspection.planId))
          .limit(1)
      : [];

    const items = inspection.planId
      ? await tx
          .select({
            planItemId: inspectionPlanItems.id,
            description: inspectionPlanItems.description,
            defaultValue: inspectionPlanItems.defaultValue,
            value: inspectionItemResponses.value,
            observation: inspectionItemResponses.observation,
          })
          .from(inspectionPlanItems)
          .leftJoin(
            inspectionItemResponses,
            and(
              eq(inspectionItemResponses.planItemId, inspectionPlanItems.id),
              eq(inspectionItemResponses.inspectionId, id),
            ),
          )
          .where(eq(inspectionPlanItems.planId, inspection.planId))
          .orderBy(asc(inspectionPlanItems.order))
      : [];

    return {
      inspection,
      equipment: equipment ?? null,
      plan: plan ?? null,
      items,
    };
  });
}

async function assertEquipmentAndPlan(
  tx: TenantTransaction,
  orgId: string,
  equipmentCatalogId: string,
  planId: string,
): Promise<boolean> {
  const [e] = await tx
    .select({ id: epiCatalog.id })
    .from(epiCatalog)
    .where(
      and(
        eq(epiCatalog.orgId, orgId),
        eq(epiCatalog.id, equipmentCatalogId),
        eq(epiCatalog.type, "machine"),
      ),
    )
    .limit(1);
  const [p] = await tx
    .select({ id: inspectionPlans.id })
    .from(inspectionPlans)
    .where(
      and(
        eq(inspectionPlans.orgId, orgId),
        eq(inspectionPlans.id, planId),
        eq(inspectionPlans.type, "equipment"),
      ),
    )
    .limit(1);
  return !!e && !!p;
}

export async function createEquipmentInspection(
  orgId: string,
  input: EquipmentInspectionHeaderValues,
): Promise<{ id: string } | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      if (
        !(await assertEquipmentAndPlan(tx, orgId, input.equipmentCatalogId, input.planId))
      ) {
        return null;
      }
      const [row] = await tx
        .insert(inspections)
        .values({
          orgId,
          type: "equipment",
          status: "in_progress",
          inspectedAt: input.inspectedAt,
          equipmentCatalogId: input.equipmentCatalogId,
          planId: input.planId,
          responsible: input.responsible ?? null,
          notes: input.notes ?? null,
        })
        .returning({ id: inspections.id });
      return { id: row.id };
    }),
  );
}

export async function updateEquipmentInspectionHeader(
  orgId: string,
  id: string,
  input: EquipmentInspectionHeaderValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      if (
        !(await assertEquipmentAndPlan(tx, orgId, input.equipmentCatalogId, input.planId))
      ) {
        return false;
      }
      const [row] = await tx
        .update(inspections)
        .set({
          inspectedAt: input.inspectedAt,
          equipmentCatalogId: input.equipmentCatalogId,
          planId: input.planId,
          responsible: input.responsible ?? null,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.id, id),
            eq(inspections.type, "equipment"),
          ),
        )
        .returning({ id: inspections.id });
      return !!row;
    }),
  );
}

export async function saveEquipmentChecklist(
  orgId: string,
  id: string,
  input: ChecklistValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [inspection] = await tx
        .select({ id: inspections.id, planId: inspections.planId })
        .from(inspections)
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.id, id),
            eq(inspections.type, "equipment"),
          ),
        )
        .limit(1);
      if (!inspection) return false;

      const validItemIds = inspection.planId
        ? new Set(
            (
              await tx
                .select({ id: inspectionPlanItems.id })
                .from(inspectionPlanItems)
                .where(eq(inspectionPlanItems.planId, inspection.planId))
            ).map((r) => r.id),
          )
        : new Set<string>();

      await tx
        .delete(inspectionItemResponses)
        .where(
          and(
            eq(inspectionItemResponses.orgId, orgId),
            eq(inspectionItemResponses.inspectionId, id),
          ),
        );

      const rows = input.responses
        .filter((r) => validItemIds.has(r.planItemId))
        .map((r) => ({
          orgId,
          inspectionId: id,
          planItemId: r.planItemId,
          value: r.value,
          observation: r.observation ?? null,
        }));
      if (rows.length > 0) await tx.insert(inspectionItemResponses).values(rows);

      await tx
        .update(inspections)
        .set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(inspections.orgId, orgId), eq(inspections.id, id)));
      return true;
    }),
  );
}

export async function deleteEquipmentInspection(
  orgId: string,
  id: string,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(inspections)
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.id, id),
            eq(inspections.type, "equipment"),
          ),
        )
        .returning({ id: inspections.id });
      return rows.length > 0;
    }),
  );
}
