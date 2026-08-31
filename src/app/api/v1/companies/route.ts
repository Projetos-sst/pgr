import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { companyInputSchema, companyStatusSchema } from "@/shared/domains/pgr/companies";
import * as repo from "@/shared/db/repositories/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const status = companyStatusSchema.safeParse(req.nextUrl.searchParams.get("status"));
  return restHandler(req, ({ tenantId }) =>
    repo.listCompanies(tenantId, {
      ...pageParamsFrom(req),
      search: req.nextUrl.searchParams.get("search") ?? undefined,
      state: req.nextUrl.searchParams.get("state") ?? undefined,
      status: status.success ? status.data : undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = companyInputSchema.parse(await req.json());
      return repo.createCompany(tenantId, input);
    },
    { status: 201 },
  );
}
