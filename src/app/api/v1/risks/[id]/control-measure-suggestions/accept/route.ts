import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runAcceptSuggestedMeasures } from "@/shared/server/pgr/ai-control-measure-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/risks/{id}/control-measure-suggestions/accept — persiste as medidas
 * revisadas em `control_measures`. 201 com `{ created }`.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { id } = await params;
      return runAcceptSuggestedMeasures(ctx, id, await req.json());
    },
    { status: 201 },
  );
}
