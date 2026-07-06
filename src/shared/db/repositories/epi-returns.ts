import "server-only";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  type NewBalance,
  type PendingReturnItem,
  type ReturnCreateValues,
  type ReturnResult,
  isReturnDateBeforeDelivery,
} from "@/shared/domains/pgr/epi-returns";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { AlreadyReturnedError } from "@/shared/errors/already-returned-error";
import { InvalidReturnError } from "@/shared/errors/invalid-return-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg } from "../with-org";
import { epiDeliveries, epiDeliveryItems, epiStock, epiCatalog } from "../schema/epis";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";
import { applyStockReturn } from "./stock-movements";

const WRITE_EVENT = "epi.return.write_rejected";

export type ListPendingReturnsParams = PageParams & {
  search?: string;
  employeeId?: string;
};

/**
 * Itens pendentes de devolução: `returned_at IS NULL` em entregas **já assinadas**
 * (`signature_status != 'pending'` — só o que deu baixa pode ser devolvido). Filtra por
 * funcionário e por nome/CA do catálogo; paginação offset. Escopado pelo tenant.
 */
export async function listPendingReturns(
  orgId: string,
  params: ListPendingReturnsParams = {},
): Promise<Paginated<PendingReturnItem>> {
  const { limit, offset } = resolvePageParams(params);

  const filters: SQL[] = [
    eq(epiDeliveryItems.orgId, orgId),
    isNull(epiDeliveryItems.returnedAt),
    ne(epiDeliveries.signatureStatus, "pending"),
  ];
  if (params.employeeId) filters.push(eq(epiDeliveries.employeeId, params.employeeId));
  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(or(ilike(epiCatalog.name, term), ilike(epiCatalog.ca, term))!);
  }
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        itemId: epiDeliveryItems.id,
        deliveryId: epiDeliveryItems.deliveryId,
        deliveryDate: epiDeliveries.deliveryDate,
        employeeId: epiDeliveries.employeeId,
        employeeName: employees.fullName,
        catalogId: epiDeliveryItems.catalogId,
        name: epiCatalog.name,
        ca: epiCatalog.ca,
        quantity: epiDeliveryItems.quantity,
      })
      .from(epiDeliveryItems)
      .innerJoin(
        epiDeliveries,
        and(
          eq(epiDeliveries.id, epiDeliveryItems.deliveryId),
          eq(epiDeliveries.orgId, orgId),
        ),
      )
      .innerJoin(
        employees,
        and(eq(employees.id, epiDeliveries.employeeId), eq(employees.orgId, orgId)),
      )
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiDeliveryItems.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(where)
      .orderBy(desc(epiDeliveries.deliveryDate), desc(epiDeliveryItems.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(epiDeliveryItems)
      .innerJoin(
        epiDeliveries,
        and(
          eq(epiDeliveries.id, epiDeliveryItems.deliveryId),
          eq(epiDeliveries.orgId, orgId),
        ),
      )
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiDeliveryItems.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(where);

    return { rows, total };
  });
}

/**
 * Registra a devolução de itens de UMA entrega (transação atômica): trava a entrega
 * (`FOR UPDATE`), valida que está **assinada** (senão `InvalidReturnError`) e que a data
 * de devolução **não é anterior** à entrega; carrega os itens pedidos (NOT_FOUND se algum
 * não pertence à entrega/tenant; `ALREADY_RETURNED` se já devolvido); por item **repõe o
 * saldo** via `applyStockReturn` (movimento `employee_return` com `delivery_id`) e carimba
 * `returned_at`. Rollback total se qualquer passo falhar.
 */
export async function recordReturn(
  orgId: string,
  input: ReturnCreateValues,
): Promise<ReturnResult> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [delivery] = await tx
        .select({
          id: epiDeliveries.id,
          signatureStatus: epiDeliveries.signatureStatus,
          deliveryDate: epiDeliveries.deliveryDate,
        })
        .from(epiDeliveries)
        .where(
          and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, input.deliveryId)),
        )
        .for("update")
        .limit(1);
      if (!delivery) throw new NotFoundError();
      if (delivery.signatureStatus === "pending") {
        throw new InvalidReturnError(
          "A entrega ainda não foi assinada — não há EPI a devolver.",
        );
      }
      if (isReturnDateBeforeDelivery(input.returnDate, delivery.deliveryDate)) {
        throw new InvalidReturnError(
          "A data de devolução não pode ser anterior à data de entrega.",
        );
      }

      const items = await tx
        .select({
          id: epiDeliveryItems.id,
          catalogId: epiDeliveryItems.catalogId,
          quantity: epiDeliveryItems.quantity,
          returnedAt: epiDeliveryItems.returnedAt,
        })
        .from(epiDeliveryItems)
        .where(
          and(
            eq(epiDeliveryItems.orgId, orgId),
            eq(epiDeliveryItems.deliveryId, input.deliveryId),
            inArray(epiDeliveryItems.id, input.itemIds),
          ),
        );
      // Algum id não pertence a esta entrega/tenant.
      if (items.length !== input.itemIds.length) throw new NotFoundError();
      if (items.some((it) => it.returnedAt !== null)) throw new AlreadyReturnedError();

      const newBalances: NewBalance[] = [];
      for (const item of items) {
        const [stock] = await tx
          .select({ id: epiStock.id, name: epiCatalog.name })
          .from(epiStock)
          .innerJoin(
            epiCatalog,
            and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
          )
          .where(and(eq(epiStock.orgId, orgId), eq(epiStock.catalogId, item.catalogId)))
          .limit(1);
        if (!stock) throw new NotFoundError();

        const { newBalance } = await applyStockReturn(tx, {
          orgId,
          stockId: stock.id,
          quantity: item.quantity,
          deliveryId: input.deliveryId,
          movementDate: input.returnDate,
        });
        newBalances.push({
          stockId: stock.id,
          catalogId: item.catalogId,
          name: stock.name,
          balance: newBalance,
        });
      }

      await tx
        .update(epiDeliveryItems)
        .set({ returnedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(epiDeliveryItems.orgId, orgId),
            inArray(epiDeliveryItems.id, input.itemIds),
          ),
        );

      return {
        deliveryId: input.deliveryId,
        returnedItemIds: input.itemIds,
        newBalances,
      };
    }),
  );
}
