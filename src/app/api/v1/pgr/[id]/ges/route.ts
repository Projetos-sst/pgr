import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { pgrGesInputSchema } from "@/shared/domains/pgr/pgr-ges";
import { getPgrById } from "@/shared/db/repositories/pgr";
import { listPgrGes, addGesToPgr } from "@/shared/db/repositories/pgr-ges";
import { assertPgrEditable } from "@/shared/server/pgr/pgr-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId } = await params;
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
    return listPgrGes(tenantId, pgrId);
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: pgrId } = await params;
      await assertPgrEditable(tenantId, pgrId); // vale como guard de existência/tenant
      const { gesId } = pgrGesInputSchema.parse(await req.json());
      return addGesToPgr(tenantId, pgrId, gesId);
    },
    { status: 201 },
  );
}
