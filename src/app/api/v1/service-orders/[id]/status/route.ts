import { z } from "zod";
import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { serviceOrderStatusSchema } from "@/shared/domains/safety/service-order";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/service-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ status: serviceOrderStatusSchema }).strict();

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const { status } = bodySchema.parse(await req.json());
    const row = await repo.setServiceOrderStatus(tenantId, id, status);
    if (!row) throw new NotFoundError();
    return row;
  });
}
