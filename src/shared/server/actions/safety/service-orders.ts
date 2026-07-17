"use server";

import { revalidatePath } from "next/cache";

import * as repo from "@/shared/db/repositories/service-orders";
import { listEmployees } from "@/shared/db/repositories/employees";
import {
  serviceOrderCreateSchema,
  serviceOrderFiltersSchema,
  serviceOrderStatusSchema,
  serviceOrderUpdateSchema,
  type ServiceOrderCreateInput,
  type ServiceOrderDetail,
  type ServiceOrderFilters,
  type ServiceOrderListItem,
  type ServiceOrderUpdateInput,
  type SuggestedItem,
} from "@/shared/domains/safety/service-order";
import type { ServiceOrder } from "@/shared/db/schema";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/service-orders";

export type EmployeeOption = { value: string; label: string };

/** Opções de funcionário (opcional) para atribuir a OS e sugerir itens do GES. */
export async function listEmployeeOptionsAction(): Promise<
  ActionResult<EmployeeOption[]>
> {
  return officeAction("safety.service_orders.employee_options", async ({ tenantId }) => {
    const { rows } = await listEmployees(tenantId, { pageSize: 100 });
    return rows.map((e) => ({ value: e.id, label: e.fullName }));
  });
}

export async function listServiceOrdersAction(
  input: ServiceOrderFilters = {},
): Promise<ActionResult<Paginated<ServiceOrderListItem>>> {
  return officeAction("safety.service_orders.list", ({ tenantId }) =>
    repo.listServiceOrders(tenantId, serviceOrderFiltersSchema.parse(input)),
  );
}

export async function getServiceOrderAction(
  id: string,
): Promise<ActionResult<ServiceOrderDetail>> {
  return officeAction("safety.service_orders.get", async ({ tenantId }) => {
    const row = await repo.getServiceOrderById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function getSuggestedItemsAction(
  employeeId: string,
): Promise<ActionResult<SuggestedItem[]>> {
  return officeAction("safety.service_orders.suggested_items", ({ tenantId }) =>
    repo.buildSuggestedItems(tenantId, employeeId),
  );
}

export async function createServiceOrderAction(
  input: ServiceOrderCreateInput,
): Promise<ActionResult<ServiceOrder>> {
  return officeAction(
    "safety.service_orders.create",
    async ({ tenantId }) => {
      const order = await repo.createServiceOrder(
        tenantId,
        serviceOrderCreateSchema.parse(input),
      );
      revalidatePath(BASE);
      return order;
    },
    { audit: true },
  );
}

export async function updateServiceOrderAction(
  id: string,
  input: ServiceOrderUpdateInput,
): Promise<ActionResult<ServiceOrder>> {
  return officeAction(
    "safety.service_orders.update",
    async ({ tenantId }) => {
      const order = await repo.updateServiceOrder(
        tenantId,
        id,
        serviceOrderUpdateSchema.parse(input),
      );
      if (!order) throw new NotFoundError();
      revalidatePath(BASE);
      revalidatePath(`${BASE}/${id}`);
      return order;
    },
    { audit: true },
  );
}

export async function setServiceOrderStatusAction(
  id: string,
  status: string,
): Promise<ActionResult<ServiceOrder>> {
  return officeAction(
    "safety.service_orders.set_status",
    async ({ tenantId }) => {
      const order = await repo.setServiceOrderStatus(
        tenantId,
        id,
        serviceOrderStatusSchema.parse(status),
      );
      if (!order) throw new NotFoundError();
      revalidatePath(BASE);
      revalidatePath(`${BASE}/${id}`);
      return order;
    },
    { audit: true },
  );
}

export async function deleteServiceOrderAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "safety.service_orders.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteServiceOrder(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}
