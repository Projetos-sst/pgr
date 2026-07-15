import "server-only";

import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type {
  ChecklistValues,
  VehicularInspectionDetail,
  VehicularInspectionHeaderValues,
  VehicularInspectionListItem,
} from "@/shared/domains/inspections/vehicular-inspections";
import { toVehicularInspectionListItem } from "@/shared/domains/inspections/vehicular-inspections";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import {
  inspectionItemResponses,
  inspectionPlanItems,
  inspectionPlans,
  inspections,
  vehicles,
} from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "inspections.vehicular.write_rejected";
const countExpr = sql<number>`count(*)::int`;

export type ListVehicularInspectionsParams = PageParams & { status?: string };

export async function listVehicularInspections(
  orgId: string,
  params: ListVehicularInspectionsParams = {},
): Promise<Paginated<VehicularInspectionListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [
    eq(inspections.orgId, orgId),
    eq(inspections.type, "vehicular"),
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
        vehiclePlate: vehicles.plate,
        planTitle: inspectionPlans.title,
      })
      .from(inspections)
      .leftJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .leftJoin(inspectionPlans, eq(inspectionPlans.id, inspections.planId))
      .where(where)
      .orderBy(desc(inspections.inspectedAt), desc(inspections.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(inspections)
      .where(where);
    return { rows: rows.map(toVehicularInspectionListItem), total };
  });
}

export async function getVehicularInspection(
  orgId: string,
  id: string,
): Promise<VehicularInspectionDetail | null> {
  return withOrg(orgId, async (tx) => {
    const [inspection] = await tx
      .select()
      .from(inspections)
      .where(
        and(
          eq(inspections.orgId, orgId),
          eq(inspections.id, id),
          eq(inspections.type, "vehicular"),
        ),
      )
      .limit(1);
    if (!inspection) return null;

    const [vehicle] = inspection.vehicleId
      ? await tx
          .select({ id: vehicles.id, plate: vehicles.plate })
          .from(vehicles)
          .where(eq(vehicles.id, inspection.vehicleId))
          .limit(1)
      : [];
    const [plan] = inspection.planId
      ? await tx
          .select({ id: inspectionPlans.id, title: inspectionPlans.title })
          .from(inspectionPlans)
          .where(eq(inspectionPlans.id, inspection.planId))
          .limit(1)
      : [];

    // Itens do plano com a resposta existente (LEFT JOIN pela resposta desta inspeção).
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
      vehicle: vehicle ?? null,
      plan: plan ?? null,
      items,
    };
  });
}

async function assertVehicleAndPlan(
  tx: TenantTransaction,
  orgId: string,
  vehicleId: string,
  planId: string,
): Promise<boolean> {
  const [v] = await tx
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, vehicleId)))
    .limit(1);
  const [p] = await tx
    .select({ id: inspectionPlans.id })
    .from(inspectionPlans)
    .where(
      and(
        eq(inspectionPlans.orgId, orgId),
        eq(inspectionPlans.id, planId),
        eq(inspectionPlans.type, "vehicular"),
      ),
    )
    .limit(1);
  return !!v && !!p;
}

export async function createVehicularInspection(
  orgId: string,
  input: VehicularInspectionHeaderValues,
): Promise<{ id: string } | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      // Veículo/plano devem ser do tenant e o plano ser veicular; senão FK_NOT_FOUND.
      if (!(await assertVehicleAndPlan(tx, orgId, input.vehicleId, input.planId))) {
        return null;
      }
      const [row] = await tx
        .insert(inspections)
        .values({
          orgId,
          type: "vehicular",
          status: "in_progress",
          inspectedAt: input.inspectedAt,
          vehicleId: input.vehicleId,
          planId: input.planId,
          responsible: input.responsible ?? null,
          driverName: input.driverName ?? null,
          driverLicense: input.driverLicense ?? null,
          currentKm: input.currentKm ?? null,
          route: input.route ?? null,
          notes: input.notes ?? null,
        })
        .returning({ id: inspections.id });
      return { id: row.id };
    }),
  );
}

export async function updateVehicularInspectionHeader(
  orgId: string,
  id: string,
  input: VehicularInspectionHeaderValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      if (!(await assertVehicleAndPlan(tx, orgId, input.vehicleId, input.planId))) {
        return false;
      }
      const [row] = await tx
        .update(inspections)
        .set({
          inspectedAt: input.inspectedAt,
          vehicleId: input.vehicleId,
          planId: input.planId,
          responsible: input.responsible ?? null,
          driverName: input.driverName ?? null,
          driverLicense: input.driverLicense ?? null,
          currentKm: input.currentKm ?? null,
          route: input.route ?? null,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inspections.orgId, orgId),
            eq(inspections.id, id),
            eq(inspections.type, "vehicular"),
          ),
        )
        .returning({ id: inspections.id });
      return !!row;
    }),
  );
}

/**
 * Salva o checklist (passo 2): substitui as respostas desta inspeção e marca
 * status `completed`. Ignora respostas de itens que não pertencem ao plano da
 * inspeção (defesa contra planItemId forjado).
 */
export async function saveChecklist(
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
            eq(inspections.type, "vehicular"),
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

export async function deleteVehicularInspection(
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
            eq(inspections.type, "vehicular"),
          ),
        )
        .returning({ id: inspections.id });
      return rows.length > 0;
    }),
  );
}
