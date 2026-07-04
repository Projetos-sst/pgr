"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { z } from "zod";

import { officeAction } from "@/shared/server/office-action";
import { toActionError } from "@/shared/server/action-error";
import { ok, type ActionResult } from "@/shared/server/result";
import {
  createDeliverySchema,
  returnSchema,
  type CreateDeliveryInput,
  type CreateDeliveryResult,
  type DeliveryDetail,
  type DeliveryRow,
  type ReturnInput,
} from "@/shared/domains/pgr/epi-deliveries";
import {
  signTokenMethodSchema,
  type SignTokenMethod,
} from "@/shared/integrations/epi-signature/token";
import { qrSvgFor } from "@/shared/integrations/epi-signature/qr";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/epi-deliveries";

// A UI de entregas vive na página do funcionário; o id concreto nem sempre está
// disponível na mutação (sign/delete), então revalida o padrão da rota.
function revalidateDeliveries(): void {
  revalidatePath("/employees/[id]", "page");
  revalidatePath("/epi-stock");
}

export async function createDeliveryAction(
  input: CreateDeliveryInput,
): Promise<ActionResult<CreateDeliveryResult>> {
  return officeAction(
    "epi.delivery.create",
    async ({ tenantId }) => {
      const data = createDeliverySchema.parse(input);
      const result = await repo.createDelivery(tenantId, data);
      revalidateDeliveries();
      return result;
    },
    { audit: true },
  );
}

export async function listDeliveriesAction(
  params: repo.ListDeliveriesParams = {},
): Promise<ActionResult<Paginated<DeliveryRow>>> {
  return officeAction("epi.delivery.list", ({ tenantId }) =>
    repo.listDeliveries(tenantId, params),
  );
}

export async function getDeliveryAction(
  id: string,
): Promise<ActionResult<DeliveryDetail>> {
  return officeAction("epi.delivery.get", ({ tenantId }) =>
    repo.getDelivery(tenantId, id),
  );
}

export async function deleteDeliveryAction(id: string): Promise<ActionResult<void>> {
  return officeAction(
    "epi.delivery.delete",
    async ({ tenantId }) => {
      await repo.deleteDelivery(tenantId, id);
      revalidateDeliveries();
    },
    { audit: true },
  );
}

export async function signDeliveryManualAction(
  id: string,
): Promise<ActionResult<{ signatureStatus: "signed_manual"; signedAt: Date }>> {
  return officeAction(
    "epi.delivery.sign_manual",
    async ({ tenantId }) => {
      const result = await repo.signDeliveryManual(tenantId, id);
      revalidateDeliveries();
      return result;
    },
    { audit: true },
  );
}

/**
 * Devolução de item da entrega (US4): guard one-shot no repositório
 * (`ALREADY_RETURNED`) + reposição do saldo via movimento `employee_return`.
 */
export async function returnDeliveryItemAction(
  deliveryId: string,
  input: ReturnInput,
): Promise<ActionResult<{ returnedAt: Date; newBalance: number }>> {
  return officeAction(
    "epi.delivery.return_item",
    async ({ tenantId }) => {
      const { itemId } = returnSchema.parse(input);
      const result = await repo.returnDeliveryItem(tenantId, deliveryId, itemId);
      revalidateDeliveries();
      return result;
    },
    { audit: true },
  );
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Gera o QR/link de assinatura (US3). Server Action interna (office staff) —
 * o token é credencial de escrita, então a geração fica atrás do gate e NÃO
 * tem espelho REST (a superfície pública testável é a própria `/sign/[token]`).
 */
export async function generateSignTokenAction(
  id: string,
  method: SignTokenMethod,
): Promise<ActionResult<{ token: string; url: string; qrSvg: string | null }>> {
  return officeAction(
    "epi.delivery.generate_sign_token",
    async ({ tenantId }) => {
      const parsedMethod = signTokenMethodSchema.parse(method);
      const { token } = await repo.generateSignToken(tenantId, id, parsedMethod);
      const url = `${await requestOrigin()}/sign/${token}`;
      const qrSvg = parsedMethod === "qr" ? await qrSvgFor(url) : null;
      return { token, url, qrSvg };
    },
    { audit: true },
  );
}

const tokenSchema = z.string().min(1);

/**
 * Leitura da rota pública `/sign/[token]` — SEM `requireOfficeStaff` e sem
 * sessão: a credencial é o token (HMAC verificado no repositório, tenant do
 * payload — R1). Erros de negócio viram `ActionResult` (nunca 500).
 */
export async function getDeliveryByTokenAction(
  token: string,
): Promise<ActionResult<repo.DeliveryByToken>> {
  try {
    return ok(await repo.getDeliveryByToken(tokenSchema.parse(token)));
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) return { ok: false, error: mapped };
    logTenantEvent("error", {
      operation: "epi.delivery.get_by_token",
      outcome: "rejected",
      orgId: null,
      userId: null,
    });
    throw error;
  }
}

/**
 * Confirmação pública da assinatura — única exceção ao gate de office nesta
 * fatia (análoga ao `requireAuth()` da CAEPI, mas aqui sem sessão alguma). O
 * `method` vem do payload assinado do token, nunca do cliente.
 */
export async function submitSignatureAction(
  token: string,
): Promise<
  ActionResult<{ signatureStatus: "signed_qr" | "signed_link"; signedAt: Date }>
> {
  try {
    const result = await repo.signByToken(tokenSchema.parse(token));
    logTenantEvent("info", {
      operation: "epi.delivery.sign_by_token",
      outcome: "ok",
      orgId: null,
      userId: null,
    });
    revalidatePath("/employees/[id]", "page");
    return ok(result);
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) {
      logTenantEvent("info", {
        operation: "epi.delivery.sign_by_token",
        outcome: "rejected",
        orgId: null,
        userId: null,
      });
      return { ok: false, error: mapped };
    }
    logTenantEvent("error", {
      operation: "epi.delivery.sign_by_token",
      outcome: "rejected",
      orgId: null,
      userId: null,
    });
    throw error;
  }
}
