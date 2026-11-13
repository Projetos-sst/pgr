import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { revokeAccessScope } from "@/shared/server/platform/access-scope-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string; scopeId: string }> };

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { userId, scopeId } = await params;
      await revokeAccessScope(ctx, userId, scopeId);
    },
    { status: 204 },
  );
}
