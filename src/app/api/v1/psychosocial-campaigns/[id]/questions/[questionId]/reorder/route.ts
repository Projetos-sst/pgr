import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; questionId: string }> };

// POST { direction: "up" | "down" }
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id, questionId } = await params;
    const body = (await req.json()) as { direction?: unknown };
    const direction = body.direction === "up" ? "up" : "down";
    const ok = await repo.reorderQuestion(tenantId, id, questionId, direction);
    if (!ok) throw new NotFoundError();
    return { id: questionId };
  });
}
