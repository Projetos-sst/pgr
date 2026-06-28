import "server-only";

import { and, eq } from "drizzle-orm";

import {
  generateAuthToken,
  signatureStatusLabel,
  type CreatedDelivery,
  type DeliveryCreateValues,
  type DeliveryDetail,
  type DeliveryResult,
  type DeliveryStatus,
  type LowStockWarning,
  type NewBalance,
} from "@/shared/domains/pgr/epi-deliveries";
import { deriveStockStatus } from "@/shared/domains/pgr/epi-stock";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { InsufficientStockError } from "@/shared/errors/insufficient-stock-error";
import { AlreadySignedError } from "@/shared/errors/already-signed-error";

import { withOrg } from "../with-org";
import { epiDeliveries, epiDeliveryItems, epiStock, epiCatalog } from "../schema/epis";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";
import { applyStockExit } from "./stock-movements";

const WRITE_EVENT = "epi.delivery.write_rejected";

/**
 * Cria uma entrega **pendente** (FR-016): valida o funcionário e a disponibilidade de
 * cada item (`balance >= quantity`) **sem baixar** o saldo, resolve `catalog_id` de cada
 * `epi_stock`, gera o `auth_token` e insere cabeçalho + itens. Tudo numa transação — se
 * algum item faltar saldo na validação, nada é gravado. A baixa só ocorre na confirmação.
 */
export async function createDelivery(
  orgId: string,
  input: DeliveryCreateValues,
): Promise<CreatedDelivery> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [employee] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.orgId, orgId), eq(employees.id, input.employeeId)))
        .limit(1);
      if (!employee) throw new NotFoundError();

      // Resolve catalog_id e valida disponibilidade (sem baixar). O item guarda
      // catalog_id (= epi_stock.catalog_id), não stock_id.
      const itemsToInsert: { catalogId: string; quantity: number }[] = [];
      for (const item of input.items) {
        const [stock] = await tx
          .select({ catalogId: epiStock.catalogId, balance: epiStock.balance })
          .from(epiStock)
          .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, item.stockId)))
          .limit(1);
        if (!stock) throw new NotFoundError();
        if (stock.balance < item.quantity) {
          throw new InsufficientStockError(stock.balance, item.quantity);
        }
        itemsToInsert.push({ catalogId: stock.catalogId, quantity: item.quantity });
      }

      const authToken = generateAuthToken();
      const [delivery] = await tx
        .insert(epiDeliveries)
        .values({
          orgId,
          employeeId: input.employeeId,
          deliveryDate: input.deliveryDate,
          signatureStatus: "pending",
          authToken,
        })
        .returning({ id: epiDeliveries.id });

      await tx.insert(epiDeliveryItems).values(
        itemsToInsert.map((it) => ({
          orgId,
          deliveryId: delivery.id,
          catalogId: it.catalogId,
          quantity: it.quantity,
        })),
      );

      return { deliveryId: delivery.id, authToken };
    }),
  );
}

/**
 * Assinatura **manual** pelo gestor (US1): trava a entrega (`FOR UPDATE`, serializa
 * confirmações concorrentes), recusa se não estiver `pending` (`AlreadySignedError`/409)
 * e faz a **baixa transacional por item** via `applyStockExit` (helper compartilhado da
 * 010): `SELECT … FOR UPDATE` → revalida `balance - quantity >= 0` (senão
 * `InsufficientStockError`/422 + **rollback total**) → `INSERT employee_delivery` (com
 * `delivery_id` e `movement_date = delivery_date`) → `UPDATE balance`. Por fim marca
 * `signed_manual`. Nunca assina sem baixar, nem baixa sem assinar (mesma transação).
 */
export async function signDeliveryManual(
  orgId: string,
  deliveryId: string,
): Promise<DeliveryResult> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [delivery] = await tx
        .select({
          id: epiDeliveries.id,
          signatureStatus: epiDeliveries.signatureStatus,
          deliveryDate: epiDeliveries.deliveryDate,
        })
        .from(epiDeliveries)
        .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, deliveryId)))
        .for("update")
        .limit(1);
      if (!delivery) throw new NotFoundError();
      if (delivery.signatureStatus !== "pending") throw new AlreadySignedError();

      const items = await tx
        .select({
          catalogId: epiDeliveryItems.catalogId,
          quantity: epiDeliveryItems.quantity,
        })
        .from(epiDeliveryItems)
        .where(
          and(
            eq(epiDeliveryItems.orgId, orgId),
            eq(epiDeliveryItems.deliveryId, deliveryId),
          ),
        );

      const newBalances: NewBalance[] = [];
      const lowStockWarnings: LowStockWarning[] = [];

      for (const item of items) {
        // Resolve a linha de epi_stock (e o nome) a partir do catalog_id do item.
        const [stock] = await tx
          .select({
            id: epiStock.id,
            minQuantity: epiStock.minQuantity,
            name: epiCatalog.name,
          })
          .from(epiStock)
          .innerJoin(
            epiCatalog,
            and(eq(epiCatalog.id, epiStock.catalogId), eq(epiCatalog.orgId, orgId)),
          )
          .where(and(eq(epiStock.orgId, orgId), eq(epiStock.catalogId, item.catalogId)))
          .limit(1);
        if (!stock) throw new NotFoundError();

        const { newBalance } = await applyStockExit(tx, {
          orgId,
          stockId: stock.id,
          quantity: item.quantity,
          type: "employee_delivery",
          deliveryId,
          movementDate: delivery.deliveryDate,
        });

        newBalances.push({
          stockId: stock.id,
          catalogId: item.catalogId,
          name: stock.name,
          balance: newBalance,
        });
        if (deriveStockStatus(newBalance, stock.minQuantity) === "abaixo_minima") {
          lowStockWarnings.push({
            stockId: stock.id,
            name: stock.name,
            balance: newBalance,
            minQuantity: stock.minQuantity,
          });
        }
      }

      await tx
        .update(epiDeliveries)
        .set({ signatureStatus: "signed_manual", updatedAt: new Date() })
        .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, deliveryId)));

      return {
        delivery: { id: deliveryId, signatureStatus: "signed_manual" },
        newBalances,
        lowStockWarnings,
      };
    }),
  );
}

/** Detalhe da entrega (cabeçalho + itens) para a visualização interna. NOT_FOUND cross-tenant. */
export async function getDelivery(
  orgId: string,
  deliveryId: string,
): Promise<DeliveryDetail> {
  return withOrg(orgId, async (tx) => {
    const [header] = await tx
      .select({
        id: epiDeliveries.id,
        employeeId: epiDeliveries.employeeId,
        employeeName: employees.fullName,
        deliveryDate: epiDeliveries.deliveryDate,
        signatureStatus: epiDeliveries.signatureStatus,
      })
      .from(epiDeliveries)
      .innerJoin(
        employees,
        and(eq(employees.id, epiDeliveries.employeeId), eq(employees.orgId, orgId)),
      )
      .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, deliveryId)))
      .limit(1);
    if (!header) throw new NotFoundError();

    const items = await tx
      .select({
        catalogId: epiDeliveryItems.catalogId,
        name: epiCatalog.name,
        ca: epiCatalog.ca,
        quantity: epiDeliveryItems.quantity,
      })
      .from(epiDeliveryItems)
      .innerJoin(
        epiCatalog,
        and(eq(epiCatalog.id, epiDeliveryItems.catalogId), eq(epiCatalog.orgId, orgId)),
      )
      .where(
        and(eq(epiDeliveryItems.orgId, orgId), eq(epiDeliveryItems.deliveryId, deliveryId)),
      );

    return {
      ...header,
      signatureStatusLabel: signatureStatusLabel(header.signatureStatus),
      items,
    };
  });
}

/** Leitura leve do status (polling do painel "Aguardando confirmação…"). NOT_FOUND cross-tenant. */
export async function getDeliveryStatus(
  orgId: string,
  deliveryId: string,
): Promise<DeliveryStatus> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ signatureStatus: epiDeliveries.signatureStatus })
      .from(epiDeliveries)
      .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, deliveryId)))
      .limit(1);
    if (!row) throw new NotFoundError();
    return {
      signatureStatus: row.signatureStatus,
      signatureStatusLabel: signatureStatusLabel(row.signatureStatus),
    };
  });
}
