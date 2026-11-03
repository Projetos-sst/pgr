import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { cancelAbsence } from "@/shared/server/medicine/absence-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Cancela registro aberto feito por engano ({ reason }); sem DELETE, o histórico fica.
export function POST(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    cancelAbsence(ctx, (await context.params).id, await readJsonBody(req)),
  );
}
