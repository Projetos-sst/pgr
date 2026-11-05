import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { companyNtep } from "@/shared/server/medicine/ntep-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Lista C para a classe CNAE cadastrada da empresa (Medicina habilitada). Só leitura.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => companyNtep(ctx, (await context.params).id));
}
