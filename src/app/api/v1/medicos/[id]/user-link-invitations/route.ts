import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  invite,
  listInvitations,
} from "@/shared/server/medicine/professional-links-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Convites de acesso do profissional (NOB-157), com a situação derivada dos eventos.
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listInvitations(ctx, (await context.params).id));
}

// Só o owner convida ({ userId, reason }); o vínculo nasce do aceite da conta convidada.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => invite(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
