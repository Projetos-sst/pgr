import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getDocument } from "@/shared/server/medicine/pcmso-document-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Versão arquivada (imutável): sem PUT/DELETE.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => getDocument(ctx, (await context.params).id));
}
