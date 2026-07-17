import "server-only";

import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import {
  canTransitionServiceOrder,
  isServiceOrderEditable,
  isServiceOrderTerminal,
  toServiceOrderListItem,
  serviceOrderStatusLabel,
  type ServiceOrderCreateValues,
  type ServiceOrderDetail,
  type ServiceOrderFilters,
  type ServiceOrderListItem,
  type ServiceOrderStatus,
  type ServiceOrderUpdateValues,
  type SuggestedItem,
} from "@/shared/domains/safety/service-order";
import {
  computeDaysOpen,
  nextServiceOrderNumber,
} from "@/shared/domains/safety/service-order-number";
import {
  SERVICE_ORDER_SIGNED_DELETE_MESSAGE,
  SERVICE_ORDER_SIGNED_EDIT_MESSAGE,
} from "@/shared/domains/safety/service-order-signature";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";
import { todayInSaoPaulo } from "@/shared/dates";

import {
  employees,
  epiCatalog,
  epiRisk,
  orgs,
  risks,
  serviceOrderItems,
  serviceOrders,
  type ServiceOrder,
  type ServiceOrderItem,
} from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";
import { isServiceOrderSignedTx } from "./service-order-signature";

const WRITE_EVENT = "safety.service_orders.write_rejected";
const countExpr = sql<number>`count(*)::int`;
const itemCountExpr = sql<number>`(
  select count(*)::int from service_order_items soi
  where soi.service_order_id = "service_orders"."id"
)`;

/** Empregado deve existir no tenant ativo (barreira real de isolamento sob RLS). */
async function assertEmployeeInTenant(
  tx: TenantTransaction,
  orgId: string,
  employeeId: string | null | undefined,
): Promise<void> {
  if (!employeeId) return; // funcionário é opcional
  const [row] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("employee");
}

/** Normaliza os itens recebidos em linhas prontas para inserir, com sort_order determinístico. */
function itemRows(
  orgId: string,
  serviceOrderId: string,
  items: ServiceOrderCreateValues["items"],
): (typeof serviceOrderItems.$inferInsert)[] {
  return items.map((item, index) => ({
    orgId,
    serviceOrderId,
    description: item.description,
    sourceType: item.sourceType,
    sourceId: item.sourceId ?? null,
    done: item.done,
    sortOrder: index,
  }));
}

export async function listServiceOrders(
  orgId: string,
  filters: ServiceOrderFilters = {},
): Promise<Paginated<ServiceOrderListItem>> {
  const { limit, offset } = resolvePageParams(filters);
  const conditions: SQL[] = [eq(serviceOrders.orgId, orgId)];
  if (filters.status) conditions.push(eq(serviceOrders.status, filters.status));
  const q = filters.q?.trim();
  if (q) {
    const term = `%${q}%`;
    const numeric = /^\d+$/.test(q) ? Number(q) : null;
    conditions.push(
      numeric != null
        ? or(ilike(serviceOrders.title, term), eq(serviceOrders.number, numeric))!
        : ilike(serviceOrders.title, term),
    );
  }
  const where = and(...conditions);
  const today = todayInSaoPaulo();
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: serviceOrders.id,
        number: serviceOrders.number,
        title: serviceOrders.title,
        status: serviceOrders.status,
        openedAt: serviceOrders.openedAt,
        dueDate: serviceOrders.dueDate,
        closedAt: serviceOrders.closedAt,
        employeeName: employees.fullName,
        itemCount: itemCountExpr,
      })
      .from(serviceOrders)
      .leftJoin(employees, eq(employees.id, serviceOrders.assignedEmployeeId))
      .where(where)
      .orderBy(desc(serviceOrders.number))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(serviceOrders)
      .where(where);
    return { rows: rows.map((r) => toServiceOrderListItem(r, today)), total };
  });
}

export async function getServiceOrderById(
  orgId: string,
  id: string,
): Promise<ServiceOrderDetail | null> {
  const today = todayInSaoPaulo();
  return withOrg(orgId, async (tx) => {
    const [order] = await tx
      .select()
      .from(serviceOrders)
      .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)))
      .limit(1);
    if (!order) return null;

    const [employee] = order.assignedEmployeeId
      ? await tx
          .select({ id: employees.id, fullName: employees.fullName })
          .from(employees)
          .where(eq(employees.id, order.assignedEmployeeId))
          .limit(1)
      : [];

    const items = await listServiceOrderItemsTx(tx, orgId, id);

    return {
      order,
      statusLabel: serviceOrderStatusLabel(order.status),
      daysOpen: computeDaysOpen(order.openedAt, order.closedAt, today),
      employee: employee ?? null,
      items,
    };
  });
}

function listServiceOrderItemsTx(
  tx: TenantTransaction,
  orgId: string,
  serviceOrderId: string,
): Promise<ServiceOrderItem[]> {
  return tx
    .select()
    .from(serviceOrderItems)
    .where(
      and(
        eq(serviceOrderItems.orgId, orgId),
        eq(serviceOrderItems.serviceOrderId, serviceOrderId),
      ),
    )
    .orderBy(asc(serviceOrderItems.sortOrder), asc(serviceOrderItems.createdAt));
}

export async function listServiceOrderItems(
  orgId: string,
  serviceOrderId: string,
): Promise<ServiceOrderItem[]> {
  return withOrg(orgId, (tx) => listServiceOrderItemsTx(tx, orgId, serviceOrderId));
}

/**
 * Sugere itens de checklist a partir do GES do funcionário: riscos do GES e EPIs
 * a eles vinculados viram snapshots textuais. Não persiste nada — a UI usa isto
 * para pré-popular o formulário; o congelamento acontece no `create`.
 */
export async function buildSuggestedItems(
  orgId: string,
  employeeId: string,
): Promise<SuggestedItem[]> {
  return withOrg(orgId, async (tx) => {
    const [employee] = await tx
      .select({ id: employees.id, gesId: employees.gesId })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
      .limit(1);
    if (!employee) throw new ReferenceNotFoundError("employee");
    if (!employee.gesId) return [];

    const riskRows = await tx
      .select({ id: risks.id, description: risks.description })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), eq(risks.gesId, employee.gesId)))
      .orderBy(asc(risks.description));

    const epiRows = await tx
      .select({ catalogId: epiCatalog.id, name: epiCatalog.name, ca: epiCatalog.ca })
      .from(epiRisk)
      .innerJoin(epiCatalog, eq(epiCatalog.id, epiRisk.catalogId))
      .innerJoin(risks, eq(risks.id, epiRisk.riskId))
      .where(and(eq(epiRisk.orgId, orgId), eq(risks.gesId, employee.gesId)))
      .orderBy(asc(epiCatalog.name));

    const suggestions: SuggestedItem[] = [];
    for (const r of riskRows) {
      suggestions.push({
        description: `Risco: ${r.description}`,
        sourceType: "risk",
        sourceId: r.id,
      });
    }
    const seenEpi = new Set<string>();
    for (const e of epiRows) {
      if (seenEpi.has(e.catalogId)) continue;
      seenEpi.add(e.catalogId);
      suggestions.push({
        description: `EPI: ${e.name}${e.ca ? ` (CA ${e.ca})` : ""}`,
        sourceType: "epi",
        sourceId: e.catalogId,
      });
    }
    return suggestions;
  });
}

export async function createServiceOrder(
  orgId: string,
  values: ServiceOrderCreateValues,
): Promise<ServiceOrder> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertEmployeeInTenant(tx, orgId, values.assignedEmployeeId);

      // Lock da linha do tenant em `orgs`: serializa a numeração POR tenant sem
      // lock global — dois creates concorrentes no mesmo org ganham números
      // consecutivos; tenants distintos não bloqueiam entre si.
      await tx.execute(sql`select id from ${orgs} where id = ${orgId} for update`);

      const [{ max }] = await tx
        .select({ max: sql<number | null>`max(${serviceOrders.number})` })
        .from(serviceOrders)
        .where(eq(serviceOrders.orgId, orgId));
      const number = nextServiceOrderNumber(max);

      const [order] = await tx
        .insert(serviceOrders)
        .values({
          orgId,
          number,
          title: values.title,
          assignedEmployeeId: values.assignedEmployeeId ?? null,
          openedAt: values.openedAt,
          dueDate: values.dueDate ?? null,
          status: "open",
        })
        .returning();

      const rows = itemRows(orgId, order.id, values.items);
      if (rows.length > 0) await tx.insert(serviceOrderItems).values(rows);

      return order;
    }),
  );
}

export async function updateServiceOrder(
  orgId: string,
  id: string,
  values: ServiceOrderUpdateValues,
): Promise<ServiceOrder | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ id: serviceOrders.id, status: serviceOrders.status })
        .from(serviceOrders)
        .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)))
        .limit(1);
      if (!current) return null;

      // Backstop de assinatura (FR-018): OS assinada é imutável. A checagem trava as solicitações
      // do alvo na MESMA transação — uma assinatura concorrente não escorrega entre o teste e o
      // commit. A UI só antecipa este bloqueio; a regra vive aqui.
      if (await isServiceOrderSignedTx(tx, orgId, id)) {
        throw new EntityInUseError(SERVICE_ORDER_SIGNED_EDIT_MESSAGE);
      }
      // Estado terminal é imutável (FR-014).
      if (isServiceOrderTerminal(current.status)) {
        throw new EntityInUseError("OS em estado terminal não pode ser editada.");
      }
      if (
        !canTransitionServiceOrder(current.status as ServiceOrderStatus, values.status)
      ) {
        throw new ValidationError("Transição de estado inválida para a OS.");
      }

      const closingNow =
        isServiceOrderTerminal(values.status) && !isServiceOrderTerminal(current.status);

      await tx
        .update(serviceOrders)
        .set({
          title: values.title,
          assignedEmployeeId: values.assignedEmployeeId ?? null,
          openedAt: values.openedAt,
          dueDate: values.dueDate ?? null,
          closedAt: values.closedAt ?? (closingNow ? todayInSaoPaulo() : null),
          status: values.status,
          updatedAt: new Date(),
        })
        .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)));

      // Substituição transacional da coleção de itens (contrato).
      await tx
        .delete(serviceOrderItems)
        .where(
          and(
            eq(serviceOrderItems.orgId, orgId),
            eq(serviceOrderItems.serviceOrderId, id),
          ),
        );
      const rows = itemRows(orgId, id, values.items);
      if (rows.length > 0) await tx.insert(serviceOrderItems).values(rows);

      const [updated] = await tx
        .select()
        .from(serviceOrders)
        .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)))
        .limit(1);
      return updated ?? null;
    }),
  );
}

export async function setServiceOrderStatus(
  orgId: string,
  id: string,
  status: ServiceOrderStatus,
): Promise<ServiceOrder | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ status: serviceOrders.status, closedAt: serviceOrders.closedAt })
        .from(serviceOrders)
        .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)))
        .limit(1);
      if (!current) return null;
      if (!canTransitionServiceOrder(current.status as ServiceOrderStatus, status)) {
        throw new ValidationError("Transição de estado inválida para a OS.");
      }
      const closedAt =
        isServiceOrderTerminal(status) && !current.closedAt
          ? todayInSaoPaulo()
          : current.closedAt;
      const [updated] = await tx
        .update(serviceOrders)
        .set({ status, closedAt, updatedAt: new Date() })
        .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)))
        .returning();
      return updated ?? null;
    }),
  );
}

export async function deleteServiceOrder(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ status: serviceOrders.status })
        .from(serviceOrders)
        .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)))
        .limit(1);
      if (!current) return false;
      // Backstop de assinatura (FR-018): OS assinada não é excluível, em nenhum estado.
      if (await isServiceOrderSignedTx(tx, orgId, id)) {
        throw new EntityInUseError(SERVICE_ORDER_SIGNED_DELETE_MESSAGE);
      }
      // Só OS ainda open/in_progress (FR-014).
      if (!isServiceOrderEditable(current.status)) {
        throw new EntityInUseError(
          "OS em estado terminal não pode ser excluída; utilize o cancelamento.",
        );
      }
      const rows = await tx
        .delete(serviceOrders)
        .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, id)))
        .returning({ id: serviceOrders.id });
      return rows.length > 0;
    }),
  );
}
