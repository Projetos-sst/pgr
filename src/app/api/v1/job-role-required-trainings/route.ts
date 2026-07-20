import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { jobRoleRequiredTrainingInputSchema } from "@/shared/domains/pgr/trainings";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import * as repo from "@/shared/db/repositories/job-role-required-trainings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobRoleIdSchema = requiredUuid("jobRoleId inválido (uuid obrigatório)");

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const jobRoleId = jobRoleIdSchema.parse(req.nextUrl.searchParams.get("jobRoleId"));
    return repo.listRequiredTrainings(tenantId, { jobRoleId });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = jobRoleRequiredTrainingInputSchema.parse(await req.json());
      return repo.addRequiredTraining(tenantId, input);
    },
    { status: 201 },
  );
}
