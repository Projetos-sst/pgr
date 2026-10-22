import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { ValidationError } from "@/shared/errors/validation-error";
import { receiveCommercialWebhook } from "@/shared/server/platform/billing-subscriptions-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) => {
    const reader = req.body?.getReader();
    if (!reader) throw new ValidationError("Evento vazio.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 16384) {
          await reader.cancel();
          throw new ValidationError("Evento muito grande.");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    return receiveCommercialWebhook(
      ctx,
      Buffer.concat(chunks).toString("utf8"),
      req.headers.get("billing-signature") ?? "",
    );
  });
}
