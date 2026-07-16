import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { trainingCatalogInputSchema } from "@/shared/domains/pgr/trainings";
import * as repo from "@/shared/db/repositories/training-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listTrainingCatalog(tenantId, pageParamsFrom(req)),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = trainingCatalogInputSchema.parse(await req.json());
      return repo.createTrainingCatalog(tenantId, input);
    },
    { status: 201 },
  );
}
