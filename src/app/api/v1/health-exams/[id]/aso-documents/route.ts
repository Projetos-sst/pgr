import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { generateDocument, listDocuments } from "@/shared/server/medicine/aso-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listDocuments(ctx, (await context.params).id));
}

// Gera e arquiva uma prévia do ASO (sem corpo); só sem bloqueios na conferência.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => generateDocument(ctx, (await context.params).id),
    {
      status: 201,
    },
  );
}
