import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { employeeInputSchema } from "@/shared/domains/pgr/employees";
import * as repo from "@/shared/db/repositories/employees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listEmployees(tenantId, {
      ...pageParamsFrom(req),
      companyId: sp.get("companyId") ?? undefined,
      status: sp.get("status") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = employeeInputSchema.parse(await req.json());
      return repo.createEmployee(tenantId, input);
    },
    { status: 201 },
  );
}
