import "server-only";

import { and, desc, eq, ilike, sql } from "drizzle-orm";

import {
  canReturn,
  signatureStatusLabel,
  type CreateDeliveryResult,
  type CreateDeliveryValues,
  type DeliveryDetail,
  type DeliveryListFilters,
  type DeliveryRow,
} from "@/shared/domains/pgr/epi-deliveries";
import { ForbiddenError } from "@/shared/auth/errors";
import { AlreadyReturnedError } from "@/shared/errors/already-returned-error";
import { AlreadySignedError } from "@/shared/errors/already-signed-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { TokenInvalidError } from "@/shared/errors/token-error";
import {
  signToken,
  verifyToken,
  type SignTokenMethod,
} from "@/shared/integrations/epi-signature/token";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { epiCatalog, epiDeliveries, epiDeliveryItems, epiStock } from "../schema/epis";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";
import { applyStockEntry, applyStockExit } from "./stock-movements";

const WRITE_EVENT = "epi.delivery.write_rejected";

export type ListDeliveriesParams = PageParams & DeliveryListFilters;

/**
 * Cria a entrega com baixa transacional por item (R8): numa única transação
 * `withOrg`, insere a entrega (`pending`); para cada item trava a linha do
 * estoque (`SELECT … FOR UPDATE`, deriva o `catalogId`), insere o item e chama
 * `applyStockExit` com o `deliveryId`. Falha em qualquer item (saldo, tenant)
 * → rollback total: nada persiste e nenhum saldo muda.
 */
export async function createDelivery(
  orgId: string,
  input: CreateDeliveryValues,
): Promise<CreateDeliveryResult> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [employee] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.orgId, orgId), eq(employees.id, input.employeeId)))
        .limit(1);
      if (!employee) throw new NotFoundError();

      const [delivery] = await tx
        .insert(epiDeliveries)
        .values({
          orgId,
          employeeId: input.employeeId,
          deliveryDate: input.deliveryDate,
        })
        .returning({
          id: epiDeliveries.id,
          signatureStatus: epiDeliveries.signatureStatus,
        });

      const items: CreateDeliveryResult["items"] = [];
      for (const item of input.items) {
        const [stock] = await tx
          .select({ id: epiStock.id, catalogId: epiStock.catalogId })
          .from(epiStock)
          .where(and(eq(epiStock.orgId, orgId), eq(epiStock.id, item.stockId)))
          .for("update")
          .limit(1);
        if (!stock) throw new NotFoundError();

        await tx.insert(epiDeliveryItems).values({
          orgId,
          deliveryId: delivery.id,
          catalogId: stock.catalogId,
          quantity: item.quantity,
        });

        const { newBalance } = await applyStockExit(tx, {
          orgId,
          stockId: item.stockId,
          quantity: item.quantity,
          type: "employee_delivery",
          deliveryId: delivery.id,
          movementDate: input.deliveryDate,
        });

        items.push({
          stockId: item.stockId,
          catalogId: stock.catalogId,
          quantity: item.quantity,
          newBalance,
        });
      }

      return { id: delivery.id, signatureStatus: delivery.signatureStatus, items };
    }),
  );
}

/** Listagem paginada das entregas do tenant (filtro por funcionário + busca por nome). */
export async function listDeliveries(
  orgId: string,
  params: ListDeliveriesParams = {},
): Promise<Paginated<DeliveryRow>> {
  const { limit, offset } = resolvePageParams(params);

  const filters = [eq(epiDeliveries.orgId, orgId)];
  if (params.employeeId) filters.push(eq(epiDeliveries.employeeId, params.employeeId));
  const search = params.search?.trim();
  if (search) filters.push(ilike(employees.fullName, `%${search}%`));
  const where = and(...filters);

  const employeeJoin = and(
    eq(employees.id, epiDeliveries.employeeId),
    eq(employees.orgId, orgId),
  );
  const itemCount = sql<number>`(select count(*)::int from ${epiDeliveryItems}
    where ${epiDeliveryItems.deliveryId} = ${epiDeliveries.id})`;

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: epiDeliveries.id,
        employeeId: epiDeliveries.employeeId,
        employeeName: employees.fullName,
        deliveryDate: epiDeliveries.deliveryDate,
        signatureStatus: epiDeliveries.signatureStatus,
        itemCount,
      })
      .from(epiDeliveries)
      .innerJoin(employees, employeeJoin)
      .where(where)
      .orderBy(desc(epiDeliveries.deliveryDate), desc(epiDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(epiDeliveries)
      .innerJoin(employees, employeeJoin)
      .where(where);

    return {
      rows: rows.map((row) => ({
        ...row,
        signatureLabel: signatureStatusLabel(row.signatureStatus),
      })),
      total,
    };
  });
}

async function loadDeliveryDetail(
  tx: TenantTransaction,
  orgId: string,
  id: string,
): Promise<DeliveryDetail | null> {
  const [row] = await tx
    .select({
      id: epiDeliveries.id,
      employeeId: epiDeliveries.employeeId,
      employeeName: employees.fullName,
      deliveryDate: epiDeliveries.deliveryDate,
      signatureStatus: epiDeliveries.signatureStatus,
      updatedAt: epiDeliveries.updatedAt,
    })
    .from(epiDeliveries)
    .innerJoin(
      employees,
      and(eq(employees.id, epiDeliveries.employeeId), eq(employees.orgId, orgId)),
    )
    .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, id)))
    .limit(1);
  if (!row) return null;

  const items = await tx
    .select({
      id: epiDeliveryItems.id,
      catalogId: epiDeliveryItems.catalogId,
      name: epiCatalog.name,
      ca: epiCatalog.ca,
      size: epiCatalog.size,
      unitOfMeasure: epiCatalog.unitOfMeasure,
      quantity: epiDeliveryItems.quantity,
      returnedAt: epiDeliveryItems.returnedAt,
    })
    .from(epiDeliveryItems)
    .innerJoin(
      epiCatalog,
      and(eq(epiCatalog.id, epiDeliveryItems.catalogId), eq(epiCatalog.orgId, orgId)),
    )
    .where(and(eq(epiDeliveryItems.orgId, orgId), eq(epiDeliveryItems.deliveryId, id)))
    .orderBy(epiCatalog.name);

  const { updatedAt, ...delivery } = row;
  return {
    ...delivery,
    signatureLabel: signatureStatusLabel(row.signatureStatus),
    signedAt: row.signatureStatus === "pending" ? null : updatedAt,
    items,
  };
}

/** Detalhe da entrega (itens + status). Inexistente/cross-tenant → `NotFoundError`. */
export async function getDelivery(orgId: string, id: string): Promise<DeliveryDetail> {
  return withOrg(orgId, async (tx) => {
    const detail = await loadDeliveryDetail(tx, orgId, id);
    if (!detail) throw new NotFoundError();
    return detail;
  });
}

/**
 * Exclui a entrega apenas enquanto `pending` — assinada é imutável (guard →
 * `ForbiddenError`; retorno de saldo só via devolução). O `SET NULL` de
 * `stock_movements.delivery_id` e o CASCADE dos itens são do banco (008).
 */
export async function deleteDelivery(orgId: string, id: string): Promise<void> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [delivery] = await tx
        .select({
          id: epiDeliveries.id,
          signatureStatus: epiDeliveries.signatureStatus,
        })
        .from(epiDeliveries)
        .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, id)))
        .for("update")
        .limit(1);
      if (!delivery) throw new NotFoundError();
      if (delivery.signatureStatus !== "pending") {
        throw new ForbiddenError("Entrega assinada não pode ser excluída.");
      }

      await tx
        .delete(epiDeliveries)
        .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, id)));
    }),
  );
}

/**
 * Assinatura manual: transição `pending → signed_manual` num UPDATE condicional
 * (one-shot atômico — corrida entre duas assinaturas só deixa uma passar). O
 * `updated_at` da transição é o timestamp legal da assinatura (ver data-model).
 */
export async function signDeliveryManual(
  orgId: string,
  id: string,
): Promise<{ signatureStatus: "signed_manual"; signedAt: Date }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const signedAt = new Date();
      const [row] = await tx
        .update(epiDeliveries)
        .set({ signatureStatus: "signed_manual", updatedAt: signedAt })
        .where(
          and(
            eq(epiDeliveries.orgId, orgId),
            eq(epiDeliveries.id, id),
            eq(epiDeliveries.signatureStatus, "pending"),
          ),
        )
        .returning({ id: epiDeliveries.id });
      if (row) return { signatureStatus: "signed_manual" as const, signedAt };

      const [existing] = await tx
        .select({ id: epiDeliveries.id })
        .from(epiDeliveries)
        .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, id)))
        .limit(1);
      if (!existing) throw new NotFoundError();
      throw new AlreadySignedError();
    }),
  );
}

/**
 * Gera o token HMAC de 72h (com o `method` embutido e assinado — R2) e o grava
 * em `auth_token` (um token ativo por entrega; regenerar substitui o anterior).
 * Só para entregas `pending` — assinada → `AlreadySignedError`.
 */
export async function generateSignToken(
  orgId: string,
  id: string,
  method: SignTokenMethod,
): Promise<{ token: string }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const token = signToken({ orgId, deliveryId: id, method });
      const [row] = await tx
        .update(epiDeliveries)
        .set({ authToken: token, updatedAt: new Date() })
        .where(
          and(
            eq(epiDeliveries.orgId, orgId),
            eq(epiDeliveries.id, id),
            eq(epiDeliveries.signatureStatus, "pending"),
          ),
        )
        .returning({ id: epiDeliveries.id });
      if (row) return { token };

      const [existing] = await tx
        .select({ id: epiDeliveries.id })
        .from(epiDeliveries)
        .where(and(eq(epiDeliveries.orgId, orgId), eq(epiDeliveries.id, id)))
        .limit(1);
      if (!existing) throw new NotFoundError();
      throw new AlreadySignedError();
    }),
  );
}

/**
 * Devolução de item (US4): numa única transação, trava o item (`FOR UPDATE`),
 * valida tenant + guard one-shot (`returned_at IS NULL`, senão
 * `AlreadyReturnedError`), seta `returned_at = now()` e repõe o saldo via
 * `applyStockEntry` (`employee_return`, vinculado à entrega). Independe do
 * status de assinatura; falha em qualquer passo → rollback total.
 */
export async function returnDeliveryItem(
  orgId: string,
  deliveryId: string,
  itemId: string,
): Promise<{ returnedAt: Date; newBalance: number }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [item] = await tx
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
            eq(epiDeliveryItems.deliveryId, deliveryId),
            eq(epiDeliveryItems.id, itemId),
          ),
        )
        .for("update")
        .limit(1);
      if (!item) throw new NotFoundError();
      if (!canReturn(item.returnedAt)) throw new AlreadyReturnedError();

      const returnedAt = new Date();
      await tx
        .update(epiDeliveryItems)
        .set({ returnedAt, updatedAt: returnedAt })
        .where(and(eq(epiDeliveryItems.orgId, orgId), eq(epiDeliveryItems.id, itemId)));

      // o estoque é por (org, catalog) — deriva a linha do catálogo do item
      const [stock] = await tx
        .select({ id: epiStock.id })
        .from(epiStock)
        .where(and(eq(epiStock.orgId, orgId), eq(epiStock.catalogId, item.catalogId)))
        .limit(1);
      if (!stock) throw new NotFoundError();

      const { newBalance } = await applyStockEntry(tx, {
        orgId,
        stockId: stock.id,
        quantity: item.quantity,
        type: "employee_return",
        deliveryId,
      });

      return { returnedAt, newBalance };
    }),
  );
}

export type DeliveryByToken = { delivery: DeliveryDetail; alreadySigned: boolean };

/**
 * Leitura da rota pública (R1): o tenant vem do payload HMAC-assinado do token
 * (nunca de input livre) e o acesso roda sob `withOrg(orgId)` — o RLS valida a
 * posse da entrega. Entrega já assinada NÃO é erro: a página mostra
 * "recebimento já confirmado" (por isso o token não precisa mais bater).
 */
export async function getDeliveryByToken(token: string): Promise<DeliveryByToken> {
  const payload = verifyToken(token);
  return withOrg(payload.orgId, async (tx) => {
    const [row] = await tx
      .select({
        authToken: epiDeliveries.authToken,
        signatureStatus: epiDeliveries.signatureStatus,
      })
      .from(epiDeliveries)
      .where(
        and(
          eq(epiDeliveries.orgId, payload.orgId),
          eq(epiDeliveries.id, payload.deliveryId),
        ),
      )
      .limit(1);
    if (!row) throw new TokenInvalidError();

    const alreadySigned = row.signatureStatus !== "pending";
    // pendente com token divergente = link revogado/substituído → resposta
    // uniforme de inválido (anti-enumeração)
    if (!alreadySigned && row.authToken !== token) throw new TokenInvalidError();

    const delivery = await loadDeliveryDetail(tx, payload.orgId, payload.deliveryId);
    if (!delivery) throw new TokenInvalidError();
    return { delivery, alreadySigned };
  });
}

/**
 * Assinatura pública: reverifica o token, resolve o tenant do payload (R1) e
 * transiciona `pending → signed_qr|signed_link` conforme o `method` ASSINADO
 * (o cliente não escolhe). O UPDATE condicional exige `auth_token = token` e
 * limpa `auth_token` na MESMA transição (invalida o link — invariante do
 * timestamp legal). Já assinada → `AlreadySignedError` (mensagem, não 500).
 */
export async function signByToken(
  token: string,
): Promise<{ signatureStatus: "signed_qr" | "signed_link"; signedAt: Date }> {
  const payload = verifyToken(token);
  const nextStatus =
    payload.method === "qr" ? ("signed_qr" as const) : ("signed_link" as const);

  return auditedTenantWrite(payload.orgId, WRITE_EVENT, () =>
    withOrg(payload.orgId, async (tx) => {
      const signedAt = new Date();
      const [row] = await tx
        .update(epiDeliveries)
        .set({ signatureStatus: nextStatus, updatedAt: signedAt, authToken: null })
        .where(
          and(
            eq(epiDeliveries.orgId, payload.orgId),
            eq(epiDeliveries.id, payload.deliveryId),
            eq(epiDeliveries.authToken, token),
            eq(epiDeliveries.signatureStatus, "pending"),
          ),
        )
        .returning({ id: epiDeliveries.id });
      if (row) return { signatureStatus: nextStatus, signedAt };

      const [existing] = await tx
        .select({ signatureStatus: epiDeliveries.signatureStatus })
        .from(epiDeliveries)
        .where(
          and(
            eq(epiDeliveries.orgId, payload.orgId),
            eq(epiDeliveries.id, payload.deliveryId),
          ),
        )
        .limit(1);
      if (existing && existing.signatureStatus !== "pending") {
        throw new AlreadySignedError();
      }
      throw new TokenInvalidError();
    }),
  );
}
