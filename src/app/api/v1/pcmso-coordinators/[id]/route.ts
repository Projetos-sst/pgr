import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as core from "@/shared/server/medicine/pcmso-coordinator-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => core.getCoordinator(ctx, (await params).id));
}

// PUT só encerra a designação aberta ({ endsOn, endReason }). Sem DELETE: o
// histórico de responsáveis pelo PCMSO é preservado (o Next responde 405).
export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) =>
    core.closeCoordinator(ctx, (await params).id, await req.json()),
  );
}
