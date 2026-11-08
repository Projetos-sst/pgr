import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  declareRiskAbsence,
  listRiskAbsence,
} from "@/shared/server/medicine/risk-absence-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Declarações de inexistência de riscos da empresa (NOB-156) e se o ator pode declarar.
export function GET(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => listRiskAbsence(ctx, (await context.params).id),
    {
      tenantAccess: true,
    },
  );
}

// Só o profissional com autorização ativa de validação de riscos: { sourceId, gesId, jobRoleId?, justification }.
// `jobRoleId` = função cadastrada vinculada ao GES (vazio = grupo todo); `jobRole` texto → 422 (NOB-112).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) =>
      declareRiskAbsence(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201, tenantAccess: true },
  );
}
