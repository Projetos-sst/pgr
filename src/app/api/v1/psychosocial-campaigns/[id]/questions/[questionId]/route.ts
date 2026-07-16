import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { questionInputSchema } from "@/shared/domains/psychosocial/campaigns";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; questionId: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id, questionId } = await params;
    const okRes = await repo.updateQuestion(
      tenantId,
      id,
      questionId,
      questionInputSchema.parse(await req.json()),
    );
    if (!okRes) throw new NotFoundError();
    return { id: questionId };
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id, questionId } = await params;
      const deleted = await repo.removeQuestion(tenantId, id, questionId);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
