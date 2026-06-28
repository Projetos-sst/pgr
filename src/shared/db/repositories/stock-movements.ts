import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import {
  signedQuantity,
  stockMovementTypeLabel,
  type StockEntryValues,
  type StockExitValues,
  type StockMovementResult,
  type StockMovementRow,
} from "@/shared/domains/pgr/stock-movements";
import type { StockMovementType } from "@/shared/domains/pgr/validation";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { InsufficientStockError } from "@/shared/errors/insufficient-stock-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { epiStock, stockMovements, epiDeliveries } from "../schema/epis";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "epi.stock_movement.write_rejected";

/** Parâmetros de uma baixa de estoque (saída) por linha, dentro de uma transação `withOrg`. */
export type StockExitParams = {
  orgId: string;
  stockId: string;
  quantity: number;
  type: StockMovementType;
  /** `YYYY-MM-DD`; quando omitido usa o default `now()` da coluna. */
  movementDate?: string;
  /** Liga o movimento à entrega que o originou (`employee_delivery`). */
  deliveryId?: string;
};

/**
 * Helper transacional de BAIXA por linha, reutilizável (extraído de `registerStockExit`):
 * trava a linha (`SELECT … FOR UPDATE`), valida `novoSaldo >= 0` na app (senão
 * `InsufficientStockError`, que aborta a transação → rollback total), insere o movimento
 * e decrementa o saldo materializado. Roda **dentro** de uma transação `withOrg` já
 * aberta — o chamador é o dono do `auditedTenantWrite`/`withOrg`. Usado pela saída manual
 * (010, ajuste/descarte) e pela baixa por entrega (011, `employee_delivery` + `delivery_id`).
 * O `CHECK balance >= 0` (008) é o backstop contra corridas que escapem da validação.
 */
export async function applyStockExit(
  tx: TenantTransaction,
  params: StockExitParams,
): Promise<StockMovementResult> {
  const { orgId, stockId, quantity } = params;
  const [stock] = await tx
    .select({ id: epiStock.id, balance: epiStock.balance })
    .from(epiStock)
    .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, stockId)))
    .for("update")
    .limit(1);
  if (!stock) throw new NotFoundError();

  const newBalance = stock.balance - quantity;
  if (newBalance < 0) throw new InsufficientStockError(stock.balance, quantity);

  const [movement] = await tx
    .insert(stockMovements)
    .values({
      orgId,
      stockId,
      deliveryId: params.deliveryId ?? null,
      type: params.type,
      quantity,
      ...(params.movementDate ? { movementDate: params.movementDate } : {}),
    })
    .returning();

  await tx
    .update(epiStock)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, stockId)));

  return { movement, newBalance };
}

/**
 * Registra uma ENTRADA (compra) numa transação atômica: trava a linha do estoque
 * (`SELECT … FOR UPDATE`), insere o movimento `purchase` e incrementa o saldo
 * materializado. Item ausente/cross-tenant → `NotFoundError` (RLS + filtro por org).
 */
export async function registerStockEntry(
  orgId: string,
  input: StockEntryValues,
): Promise<StockMovementResult> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [stock] = await tx
        .select({ id: epiStock.id, balance: epiStock.balance })
        .from(epiStock)
        .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, input.stockId)))
        .for("update")
        .limit(1);
      if (!stock) throw new NotFoundError();

      const newBalance = stock.balance + input.quantity;

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          orgId,
          stockId: input.stockId,
          type: "purchase",
          quantity: input.quantity,
          movementDate: input.movementDate,
          invoiceNumber: input.invoiceNumber ?? null,
        })
        .returning();

      await tx
        .update(epiStock)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, input.stockId)));

      return { movement, newBalance };
    }),
  );
}

/**
 * Registra uma SAÍDA manual (ajuste/descarte) numa transação atômica: trava a linha,
 * valida `novoSaldo >= 0` na app (senão `InsufficientStockError` + rollback total),
 * insere o movimento e decrementa o saldo. `CHECK balance >= 0` (008) é o backstop
 * contra corridas que escapem da validação.
 */
export async function registerStockExit(
  orgId: string,
  input: StockExitValues,
): Promise<StockMovementResult> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, (tx) =>
      applyStockExit(tx, {
        orgId,
        stockId: input.stockId,
        quantity: input.quantity,
        type: input.type,
        movementDate: input.movementDate,
      }),
    ),
  );
}

export type ListStockMovementsParams = PageParams;

type StockMovementQueryRow = {
  id: string;
  type: StockMovementRow["type"];
  quantity: number;
  movementDate: string;
  invoiceNumber: string | null;
  createdAt: Date;
  employeeName: string | null;
  runningBalance: number | string;
};

function toStockMovementRow(row: StockMovementQueryRow): StockMovementRow {
  return {
    id: row.id,
    type: row.type,
    typeLabel: stockMovementTypeLabel(row.type),
    quantity: row.quantity,
    signedQuantity: signedQuantity(row.type, row.quantity),
    movementDate: row.movementDate,
    invoiceNumber: row.invoiceNumber,
    employeeName: row.employeeName,
    runningBalance: Number(row.runningBalance),
    createdAt: row.createdAt,
  };
}

/**
 * Histórico paginado de um item de estoque, do mais recente ao mais antigo
 * (`movement_date DESC, created_at DESC`). O **saldo resultante** por linha é derivado
 * por window function (ordem cronológica ascendente) — sem coluna `balance_after`. A
 * window é avaliada sobre todo o histórico do item (antes do `LIMIT`), então o saldo
 * acumulado fica correto mesmo paginando. `LEFT JOIN` traz o funcionário quando o
 * movimento veio de uma entrega (`employee_delivery`; demais tipos → `null`).
 */
export async function listStockMovements(
  orgId: string,
  stockId: string,
  params: ListStockMovementsParams = {},
): Promise<Paginated<StockMovementRow>> {
  const { limit, offset } = resolvePageParams(params);

  return withOrg(orgId, async (tx) => {
    const [stock] = await tx
      .select({ id: epiStock.id })
      .from(epiStock)
      .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, stockId)))
      .limit(1);
    if (!stock) throw new NotFoundError();

    const runningBalance = sql<number>`(sum(
      case when ${stockMovements.type} = 'purchase'
        then ${stockMovements.quantity}
        else -${stockMovements.quantity}
      end
    ) over (order by ${stockMovements.movementDate} asc, ${stockMovements.createdAt} asc))::int`;

    const rows = await tx
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        movementDate: stockMovements.movementDate,
        invoiceNumber: stockMovements.invoiceNumber,
        createdAt: stockMovements.createdAt,
        employeeName: employees.fullName,
        runningBalance,
      })
      .from(stockMovements)
      .leftJoin(
        epiDeliveries,
        and(
          eq(epiDeliveries.id, stockMovements.deliveryId),
          eq(epiDeliveries.orgId, orgId),
        ),
      )
      .leftJoin(
        employees,
        and(eq(employees.id, epiDeliveries.employeeId), eq(employees.orgId, orgId)),
      )
      .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.stockId, stockId)))
      .orderBy(desc(stockMovements.movementDate), desc(stockMovements.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(stockMovements)
      .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.stockId, stockId)));

    return { rows: rows.map(toStockMovementRow), total };
  });
}
