import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { trainingRecordInputSchema } from "@/shared/domains/pgr/trainings";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import * as repo from "@/shared/db/repositories/training-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const employeeIdSchema = requiredUuid("employeeId inválido (uuid obrigatório)");

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const employeeId = employeeIdSchema.parse(req.nextUrl.searchParams.get("employeeId"));
    return repo.listTrainingRecordsByEmployee(tenantId, {
      ...pageParamsFrom(req),
      employeeId,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = trainingRecordInputSchema.parse(await req.json());
      return repo.createTrainingRecord(tenantId, input);
    },
    { status: 201 },
  );
}
