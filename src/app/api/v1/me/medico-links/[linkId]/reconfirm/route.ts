import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { reconfirmLink } from "@/shared/server/medicine/identity-verification-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ linkId: string }> };

// Reconfirmação explícita de vínculo legado pela própria conta (NOB-159).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => reconfirmLink(ctx, (await context.params).linkId),
    {
      status: 201,
      tenantAccess: true,
    },
  );
}
