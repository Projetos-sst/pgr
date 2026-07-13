import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { pgrRevisionInputSchema } from "@/shared/domains/pgr/pgr-revision";
import { getPgrById } from "@/shared/db/repositories/pgr";
import {
  listPgrRevisions,
  createPgrRevision,
} from "@/shared/db/repositories/pgr-revisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId } = await params;
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
    return listPgrRevisions(tenantId, pgrId);
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: pgrId } = await params;
      if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
      const values = pgrRevisionInputSchema.parse(await req.json());
      return createPgrRevision(tenantId, pgrId, values);
    },
    { status: 201 },
  );
}
