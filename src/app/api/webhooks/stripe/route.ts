import { constructWebhookEvent } from "@/shared/integrations/stripe/client";
import { handleStripeEvent } from "@/shared/server/platform/billing-core";
import { logTenantEvent } from "@/shared/tenant/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do Stripe (público — a credencial é a ASSINATURA, verificada abaixo,
 * não a sessão Clerk). Corpo lido cru para a verificação HMAC. Nunca confia no
 * payload sem assinatura válida.
 */
export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const payload = await req.text();

  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    logTenantEvent("error", {
      operation: `webhook.stripe ${event.type}`,
      outcome: "rejected",
      orgId: null,
      userId: null,
    });
    throw error;
  }

  return new Response("ok", { status: 200 });
}
