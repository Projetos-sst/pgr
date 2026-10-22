import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { synchronizeMockPaymentProfile } from "@/shared/server/platform/billing-portal-core";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => {
    const body = z
      .object({ method: z.literal("visa_test_4242") })
      .strict()
      .parse(await readJsonBody(req));
    return synchronizeMockPaymentProfile(ctx, { ...body, sessionId: (await params).id });
  });
}
