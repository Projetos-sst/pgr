import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { accidentStatusTransitionSchema } from "@/shared/domains/safety/accident";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/accidents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const { status, justification } = accidentStatusTransitionSchema.parse(
      await req.json(),
    );
    const row = await repo.setAccidentStatus(tenantId, id, status, justification);
    if (!row) throw new NotFoundError();
    return row;
  });
}
