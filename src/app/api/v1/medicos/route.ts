import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { medicoInputSchema, MEDICO_STATUSES } from "@/shared/domains/pgr/medicos";
import type { MedicoStatus } from "@/shared/domains/pgr/medicos";
import * as repo from "@/shared/db/repositories/medicos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusFrom(req: NextRequest): MedicoStatus | undefined {
  const value = req.nextUrl.searchParams.get("status");
  return (MEDICO_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as MedicoStatus)
    : undefined;
}

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listMedicos(tenantId, {
      ...pageParamsFrom(req),
      search: req.nextUrl.searchParams.get("search") ?? undefined,
      status: statusFrom(req),
      clinic: req.nextUrl.searchParams.get("clinic") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = medicoInputSchema.parse(await req.json());
      return repo.createMedico(tenantId, input);
    },
    { status: 201 },
  );
}
