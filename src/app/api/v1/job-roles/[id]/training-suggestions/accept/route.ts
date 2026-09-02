import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { runAcceptSuggestedTrainings } from "@/shared/server/pgr/ai-required-training-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/job-roles/{id}/training-suggestions/accept — vincula os treinamentos
 * revisados, criando no catálogo os que faltarem. 201 com `{ linked, createdInCatalog }`.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { id } = await params;
      return runAcceptSuggestedTrainings(ctx, id, await req.json());
    },
    { status: 201 },
  );
}
