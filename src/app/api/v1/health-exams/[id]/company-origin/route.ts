import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { confirmCompanyOrigin } from "@/shared/server/medicine/aso-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Confirma a empresa de origem de exame antigo ({ justification }); só o responsável (owner).
export function POST(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    confirmCompanyOrigin(ctx, (await context.params).id, await readJsonBody(req)),
  );
}
