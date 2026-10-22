import { z } from "zod";
import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { acknowledgeCommercialInterest } from "@/shared/server/platform/billing-interests-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => {
    const body = z
      .object({ reason: z.string() })
      .strict()
      .parse(await readJsonBody(req));
    return acknowledgeCommercialInterest(ctx, { ...body, id: (await params).id });
  });
}
