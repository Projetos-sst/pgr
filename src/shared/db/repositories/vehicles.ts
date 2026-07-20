import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type {
  VehicleListItem,
  VehicleValues,
} from "@/shared/domains/inspections/vehicles";
import { toVehicleListItem } from "@/shared/domains/inspections/vehicles";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { vehicles, type Vehicle } from "../schema";
import { withOrg } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "inspections.vehicles.write_rejected";

export type ListVehiclesParams = PageParams & { search?: string };

function toColumns(input: VehicleValues) {
  return {
    plate: input.plate,
    brand: input.brand ?? null,
    model: input.model ?? null,
    type: input.type ?? null,
    color: input.color ?? null,
    owner: input.owner ?? null,
    initialKm: input.initialKm,
    photoPath: input.photoPath ?? null,
    notes: input.notes ?? null,
  };
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
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(vehicles)
      .where(where)
      .orderBy(desc(vehicles.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(where);
    return { rows: rows.map(toVehicleListItem), total };
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
