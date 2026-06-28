"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  deliveryCreateSchema,
  type DeliveryCreateInput,
  type CreatedDelivery,
  type DeliveryDetail,
  type DeliveryResult,
  type DeliveryStatus,
} from "@/shared/domains/pgr/epi-deliveries";
import type { EpiStockListItem } from "@/shared/domains/pgr/epi-stock";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/epi-deliveries";
import { listEpiStock, type ListEpiStockParams } from "@/shared/db/repositories/epi-stock";

const STOCK_PATH = "/epi-stock";

/** Cria a entrega pendente (sem baixa). Revalida a página de entrega do funcionário. */
export async function createDeliveryAction(
  input: DeliveryCreateInput,
): Promise<ActionResult<CreatedDelivery>> {
  return officeAction(
    "epi.delivery.create",
    async ({ tenantId }) => {
      const data = deliveryCreateSchema.parse(input);
      const result = await repo.createDelivery(tenantId, data);
      revalidatePath(`/employees/${data.employeeId}/epi-delivery`);
      return result;
    },
    { audit: true },
  );
}

/** Assina manual + baixa transacional. Revalida o estoque (saldos mudaram). */
export async function signDeliveryManualAction(
  deliveryId: string,
): Promise<ActionResult<DeliveryResult>> {
  return officeAction(
    "epi.delivery.sign_manual",
    async ({ tenantId }) => {
      const result = await repo.signDeliveryManual(tenantId, deliveryId);
      revalidatePath(STOCK_PATH);
      return result;
    },
    { audit: true },
  );
}

/** Leitura do status para o polling do painel "Aguardando confirmação…" (sem audit). */
export async function getDeliveryStatusAction(
  deliveryId: string,
): Promise<ActionResult<DeliveryStatus>> {
  return officeAction("epi.delivery.status", ({ tenantId }) =>
    repo.getDeliveryStatus(tenantId, deliveryId),
  );
}

/** Detalhe da entrega para visualização interna (sem audit). */
export async function getDeliveryAction(
  deliveryId: string,
): Promise<ActionResult<DeliveryDetail>> {
  return officeAction("epi.delivery.get", ({ tenantId }) =>
    repo.getDelivery(tenantId, deliveryId),
  );
}

/** Passo 1 (seleção): só itens de estoque com saldo > 0. Reuso de `listEpiStock` (009). */
export async function listDeliverableStockAction(
  params: Omit<ListEpiStockParams, "withBalanceOnly"> = {},
): Promise<ActionResult<Paginated<EpiStockListItem>>> {
  return officeAction("epi.delivery.list_stock", ({ tenantId }) =>
    listEpiStock(tenantId, { ...params, withBalanceOnly: true }),
  );
}
