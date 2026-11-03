import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { confirmReturn } from "@/shared/server/medicine/absence-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Retorno confirmado ({ returnedOn }); não registra exame nem aptidão.
export function POST(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    confirmReturn(ctx, (await context.params).id, await readJsonBody(req)),
  );
}
