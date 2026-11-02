import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  generateDocument,
  listDocuments,
} from "@/shared/server/medicine/pcmso-document-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listDocuments(ctx, (await context.params).id));
}

// Gera e arquiva uma prévia ({ cycleStart }); só sem bloqueios na conferência do PCMSO.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      generateDocument(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
