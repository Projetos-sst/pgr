import "server-only";

import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  toEpiStockListItem,
  type EpiStockCreateValues,
  type EpiStockUpdateValues,
  type EpiStockListItem,
  type EpiStockListFilters,
  type EpiStockDetail,
  type EpiCatalogOption,
} from "@/shared/domains/pgr/epi-stock";
import { todayInSaoPaulo } from "@/shared/dates";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg } from "../with-org";
import { epiStock, epiCatalog, stockMovements, type EpiStock } from "../schema/epis";
import { auditedTenantWrite } from "./audited-write";
import { applyStockEntry } from "./stock-movements";

export type ListEpiStockParams = PageParams & EpiStockListFilters;

// Colunas projetadas na listagem/detalhe (vocabulário ePGR no DTO).
const listColumns = {
  id: epiStock.id,
  catalogId: epiStock.catalogId,
  name: epiCatalog.name,
  ca: epiCatalog.ca,
  size: epiCatalog.size,
  unitOfMeasure: epiCatalog.unitOfMeasure,
  minimumQuantity: epiStock.minQuantity,
  currentBalance: epiStock.balance,
} as const;

/** Condição SQL do status derivado (espelha `deriveStockStatus`). */
function statusFilter(status: EpiStockListFilters["status"]): SQL | undefined {
  switch (status) {
    case "sem_saldo":
      return sql`${epiStock.balance} <= 0`;
    case "abaixo_minima":
      return sql`${epiStock.balance} > 0 and ${epiStock.balance} < ${epiStock.minQuantity}`;
    case "acima_minima":
      return sql`${epiStock.balance} > 0 and ${epiStock.balance} >= ${epiStock.minQuantity}`;
    default:
      return undefined;
  }
}

/**
 * Condição SQL do filtro de validade de CA (derivado na leitura, espelha
 * `EpiStockCaStatus`). CA sem validade cadastrada (`caValidUntil` nulo) conta
 * como válido — não deve ser escondido pelo filtro `"valid"`.
 */
function caStatusFilter(caStatus: EpiStockListFilters["caStatus"]): SQL | undefined {
  const today = todayInSaoPaulo();
  switch (caStatus) {
    case "expired":
      return lt(epiCatalog.caValidUntil, today);
    case "valid":
      return or(isNull(epiCatalog.caValidUntil), gte(epiCatalog.caValidUntil, today));
    default:
      return undefined;
  }
}

export async function listEpiStock(
  orgId: string,
  params: ListEpiStockParams = {},
): Promise<Paginated<EpiStockListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(epiStock.orgId, orgId)];

  if (params.withBalanceOnly) filters.push(sql`${epiStock.balance} > 0`);
  const byStatus = statusFilter(params.status);
  if (byStatus) filters.push(byStatus);
  if (params.categoryId) filters.push(eq(epiCatalog.categoryId, params.categoryId));
  const byCaStatus = caStatusFilter(params.caStatus);
  if (byCaStatus) filters.push(byCaStatus);

  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(or(ilike(epiCatalog.name, term), ilike(epiCatalog.ca, term))!);
  }
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select(listColumns)
      .from(epiStock)
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(where)
      .orderBy(desc(epiStock.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(epiStock)
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(where);

    return { rows: rows.map(toEpiStockListItem), total };
  });
}

export async function getEpiStockById(
  orgId: string,
  id: string,
): Promise<EpiStockDetail | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        ...listColumns,
        type: epiCatalog.type,
        categoryId: epiCatalog.categoryId,
      })
      .from(epiStock)
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, id)))
      .limit(1);
    if (!row) return null;
    return { ...toEpiStockListItem(row), type: row.type, categoryId: row.categoryId };
  });
}

export async function createEpiStock(
  orgId: string,
  input: EpiStockCreateValues,
): Promise<EpiStock> {
  return auditedTenantWrite(orgId, "epi.epi_stock.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      // `balance` NÃO é escrito aqui — usa o default 0; só movimentações (#72) o alteram.
      const [row] = await tx
        .insert(epiStock)
        .values({ orgId, catalogId: input.catalogId, minQuantity: input.minimumQuantity })
        .returning();

      // Saldo inicial (opcional, #22): lançado como movimentação `purchase` na MESMA
      // transação, nunca escrito direto em `balance` — preserva a trilha de auditoria de
      // `stock_movements`. `applyStockEntry` já atualiza `epi_stock.balance`; refletimos o
      // resultado no retorno para quem chamou ver o saldo correto de imediato.
      if (input.initialQuantity && input.initialQuantity > 0) {
        const { newBalance } = await applyStockEntry(tx, {
          orgId,
          stockId: row.id,
          quantity: input.initialQuantity,
          type: "purchase",
        });
        return { ...row, balance: newBalance };
      }

      return row;
    }),
  );
}

export async function updateEpiStock(
  orgId: string,
  id: string,
  input: EpiStockUpdateValues,
): Promise<EpiStock | null> {
  return auditedTenantWrite(orgId, "epi.epi_stock.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      // Edita APENAS a mínima. `balance` jamais entra no set (somente leitura).
      const [row] = await tx
        .update(epiStock)
        .set({ minQuantity: input.minimumQuantity, updatedAt: new Date() })
        .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteEpiStock(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "epi.epi_stock.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(epiStock)
        .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, id)))
        .returning({ id: epiStock.id });
      return rows.length > 0;
    }),
  );
}

/** Para o aviso de exclusão: nº de movimentações que serão removidas em CASCADE (008). */
export async function countEpiStockDependents(
  orgId: string,
  id: string,
): Promise<{ movements: number }> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(stockMovements)
      .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.stockId, id)));
    return { movements: row.total };
  });
}

/** Itens do catálogo ainda SEM estoque no tenant (popula o seletor de "Criar"). */
export async function listAvailableCatalogOptions(
  orgId: string,
): Promise<EpiCatalogOption[]> {
  return withOrg(orgId, async (tx) => {
    const used = tx
      .select({ id: epiStock.catalogId })
      .from(epiStock)
      .where(eq(epiStock.orgId, orgId));
    return tx
      .select({ catalogId: epiCatalog.id, name: epiCatalog.name, ca: epiCatalog.ca })
      .from(epiCatalog)
      .where(and(eq(epiCatalog.orgId, orgId), notInArray(epiCatalog.id, used)))
      .orderBy(epiCatalog.name);
  });
}
