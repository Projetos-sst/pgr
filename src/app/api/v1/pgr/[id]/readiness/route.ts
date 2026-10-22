import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getPgrReadiness } from "@/shared/server/pgr/pgr-readiness-core";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return restHandler(req, async (ctx) =>
    getPgrReadiness(ctx.tenantId, (await params).id),
  );
}
