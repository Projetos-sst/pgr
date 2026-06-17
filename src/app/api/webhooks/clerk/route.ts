import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { WebhookEvent } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import {
  type ClerkSyncResult,
  handleClerkEvent,
} from "@/shared/clerk-sync/clerk-sync-service";
import { logClerkSync } from "@/shared/clerk-sync/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTTP_STATUS_BY_RESULT: Record<ClerkSyncResult["status"], number> = {
  ok: 200,
  ignored: 200,
  invalid_payload: 400,
};

export async function POST(req: NextRequest): Promise<Response> {
  let event: WebhookEvent;
  try {
    event = await verifyWebhook(req);
  } catch (error) {
    logClerkSync("error", {
      operation: "clerk.webhook",
      phase: "rejected",
      reason: "invalid_signature",
      message: errorMessage(error),
    });
    return new Response("invalid signature", { status: 400 });
  }

  try {
    const result = await handleClerkEvent(event);
    return new Response(result.status, {
      status: HTTP_STATUS_BY_RESULT[result.status],
    });
  } catch (error) {
    logClerkSync("error", {
      operation: "clerk.webhook",
      phase: "error",
      type: event.type,
      message: errorMessage(error),
    });
    return new Response("db error", { status: 500 });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
