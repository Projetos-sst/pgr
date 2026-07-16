import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/equipment-inspections";
import { checklistSchema } from "@/shared/domains/inspections/equipment-inspections";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// PUT substitui as respostas do checklist e conclui a inspeção.
export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const ok = await repo.saveEquipmentChecklist(
      tenantId,
      id,
      checklistSchema.parse(await req.json()),
    );
    if (!ok) throw new NotFoundError();
    return { id };
  });
}
