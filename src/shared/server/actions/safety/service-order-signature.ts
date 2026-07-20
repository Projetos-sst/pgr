"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import { serviceOrderSignatureRequestSchema } from "@/shared/domains/safety/service-order-signature";
import type { ServiceOrderSignatureView } from "@/shared/domains/safety/service-order-signature";
import {
  createServiceOrderSignature,
  getServiceOrderSignatureView,
  type CreateServiceOrderSignatureResult,
} from "@/shared/server/safety/service-order-signature-core";

/**
 * Cria a solicitação de assinatura da OS (office staff; `client` → FORBIDDEN pelo `officeAction`).
 * Casca fina: valida `ttlSeconds` com Zod e delega ao core, que monta o payload no servidor e aplica
 * a cota compartilhada. A auditoria registra só a operação — nunca o token, a URL pública ou PII.
 */
export async function createServiceOrderSignatureRequestAction(input: {
  serviceOrderId: string;
  ttlSeconds?: number;
}): Promise<ActionResult<CreateServiceOrderSignatureResult>> {
  return officeAction(
    "service_orders.signature.create",
    async (ctx) => {
      const { serviceOrderId, ...rest } = input;
      const opts = serviceOrderSignatureRequestSchema.parse(rest);
      const result = await createServiceOrderSignature(ctx, serviceOrderId, opts);
      revalidatePath(`/service-orders/${serviceOrderId}`);
      return result;
    },
    { audit: true },
  );
}

/** Estado derivado da assinatura da OS (leitura, sem audit; nunca devolve token/URL). */
export async function getServiceOrderSignatureViewAction(input: {
  serviceOrderId: string;
}): Promise<ActionResult<ServiceOrderSignatureView>> {
  return officeAction("service_orders.signature.get", (ctx) =>
    getServiceOrderSignatureView(ctx, input.serviceOrderId),
  );
}
