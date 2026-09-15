import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { esocialConfigInputSchema } from "@/shared/domains/esocial/config";
import * as repo from "@/shared/db/repositories/esocial-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Config é um singleton por tenant → sem coleção/[id]: GET lê, PUT faz upsert.
export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => repo.getEsocialConfig(tenantId));
}

export function PUT(req: NextRequest) {
  return restHandler(req, async ({ tenantId }) => {
    const input = esocialConfigInputSchema.parse(await req.json());
    return repo.upsertEsocialConfig(tenantId, input);
  });
}
