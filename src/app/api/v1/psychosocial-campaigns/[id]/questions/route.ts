import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { questionInputSchema } from "@/shared/domains/psychosocial/campaigns";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getCampaignWithQuestions(tenantId, id);
    if (!row) throw new NotFoundError();
    return row.questions;
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      return repo.addQuestion(tenantId, id, questionInputSchema.parse(await req.json()));
    },
    { status: 201 },
  );
}
