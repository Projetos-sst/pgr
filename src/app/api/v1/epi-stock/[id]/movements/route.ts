import type { NextRequest } from "next/server";
import { z } from "zod";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { stockEntrySchema, stockExitSchema } from "@/shared/domains/pgr/stock-movements";
import * as repo from "@/shared/db/repositories/stock-movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// `id` (path) é o stockId; `kind` no corpo discrimina entrada × saída.
const kindSchema = z.enum(["entry", "exit"], { error: "kind inválido" });

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const body = (await req.json()) as Record<string, unknown>;
      const kind = kindSchema.parse(body?.kind);

      if (kind === "exit") {
        const input = stockExitSchema.parse({ ...body, stockId: id });
        return repo.registerStockExit(tenantId, input);
      }
      const input = stockEntrySchema.parse({ ...body, stockId: id });
      return repo.registerStockEntry(tenantId, input);
    },
    { status: 201 },
  );
}

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    return repo.listStockMovements(tenantId, id, pageParamsFrom(req));
  });
}
