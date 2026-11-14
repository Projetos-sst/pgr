import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { requireMaster } from "@/shared/auth/require-master";
import { rejectRequest } from "@/shared/server/medicine/identity-verification-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Recusa do pedido pelo operador (master pela sessão real E designado no banco) ({ reason }).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async () =>
      rejectRequest(
        (await requireMaster()).userId,
        (await context.params).id,
        await readJsonBody(req),
      ),
    { status: 201, tenantAccess: true },
  );
}
