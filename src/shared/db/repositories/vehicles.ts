import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type {
  VehicleFilters,
  VehicleListItem,
  VehicleValues,
} from "@/shared/domains/inspections/vehicles";
import {
  toVehicleListItem,
  isVehiclePhotoPathForTenant,
} from "@/shared/domains/inspections/vehicles";
import { ValidationError } from "@/shared/errors/validation-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";
import { todayInSaoPaulo } from "@/shared/dates";

import { companies, inspectionPlans, vehicles, workUnits, type Vehicle } from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "inspections.vehicles.write_rejected";

// Última inspeção veicular concluída do veículo (data), base do Status derivado.
const lastInspectedExpr = sql<string | null>`(
  select max(i.inspected_at) from inspections i
  where i.vehicle_id = "vehicles"."id"
    and i.org_id = "vehicles"."org_id"
    and i.type = 'vehicular'
    and i.status = 'completed'
)`;

export type ListVehiclesParams = VehicleFilters;

function toColumns(input: VehicleValues) {
  return {
    plate: input.plate,
    renavam: input.renavam ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    type: input.type ?? null,
    year: input.year ?? null,
    color: input.color ?? null,
    owner: input.owner ?? null,
    companyId: input.companyId ?? null,
    workUnitId: input.workUnitId ?? null,
    inspectionPlanId: input.inspectionPlanId ?? null,
    inspectionFrequency: input.inspectionFrequency ?? null,
    initialKm: input.initialKm,
    photoPath: input.photoPath ?? null,
    notes: input.notes ?? null,
  };
}

/** FKs opcionais devem existir no tenant ativo (barreira real sob RLS; FK ignora RLS). */
async function assertRefs(
  tx: TenantTransaction,
  orgId: string,
  input: VehicleValues,
): Promise<void> {
  if (input.photoPath && !isVehiclePhotoPathForTenant(input.photoPath, orgId)) {
    throw new ValidationError("Foto inválida para o escritório ativo.");
  }
  if (input.companyId) {
    const [row] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, input.companyId)))
      .limit(1);
    if (!row) throw new ReferenceNotFoundError("company");
  }
  if (input.workUnitId) {
    const [row] = await tx
      .select({ id: workUnits.id })
      .from(workUnits)
      .where(and(eq(workUnits.orgId, orgId), eq(workUnits.id, input.workUnitId)))
      .limit(1);
    if (!row) throw new ReferenceNotFoundError("work_unit");
  }
  if (input.inspectionPlanId) {
    const [row] = await tx
      .select({ id: inspectionPlans.id })
      .from(inspectionPlans)
      .where(
        and(
          eq(inspectionPlans.orgId, orgId),
          eq(inspectionPlans.id, input.inspectionPlanId),
        ),
      )
      .limit(1);
    if (!row) throw new ReferenceNotFoundError("inspection_plan");
  }
}

export async function listVehiclesPaginated(
  orgId: string,
  params: ListVehiclesParams = {},
): Promise<Paginated<VehicleListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(vehicles.orgId, orgId)];
  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(
      or(
        ilike(vehicles.plate, term),
        ilike(vehicles.model, term),
        ilike(vehicles.brand, term),
      )!,
    );
  }
  if (params.companyId) filters.push(eq(vehicles.companyId, params.companyId));
  const where = and(...filters);
  const today = todayInSaoPaulo();
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: vehicles.id,
        plate: vehicles.plate,
        brand: vehicles.brand,
        model: vehicles.model,
        type: vehicles.type,
        year: vehicles.year,
        owner: vehicles.owner,
        initialKm: vehicles.initialKm,
        inspectionFrequency: vehicles.inspectionFrequency,
        companyName: companies.razaoSocial,
        lastInspectedAt: lastInspectedExpr,
      })
      .from(vehicles)
      .leftJoin(companies, eq(companies.id, vehicles.companyId))
      .where(where)
      .orderBy(desc(vehicles.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(where);
    return { rows: rows.map((r) => toVehicleListItem(r, today)), total };
  });
}

export async function getVehicle(orgId: string, id: string): Promise<Vehicle | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createVehicle(
  orgId: string,
  input: VehicleValues,
): Promise<Vehicle> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertRefs(tx, orgId, input);
      const [row] = await tx
        .insert(vehicles)
        .values({ orgId, ...toColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateVehicle(
  orgId: string,
  id: string,
  input: VehicleValues,
): Promise<Vehicle | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertRefs(tx, orgId, input);
      const [row] = await tx
        .update(vehicles)
        .set({ ...toColumns(input), updatedAt: new Date() })
        .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteVehicle(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(vehicles)
        .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, id)))
        .returning({ id: vehicles.id });
      return rows.length > 0;
    }),
  );
}
