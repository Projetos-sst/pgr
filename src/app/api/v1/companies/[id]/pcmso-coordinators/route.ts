import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as core from "@/shared/server/medicine/pcmso-coordinator-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Histórico de coordenadores do PCMSO da empresa (mais recente primeiro).
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => core.listCoordinators(ctx, (await params).id));
}

// Designa o coordenador; a designação aberta é encerrada na véspera da nova.
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => core.designateCoordinator(ctx, (await params).id, await req.json()),
    { status: 201 },
  );
}
