import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { jobRoleInputSchema } from "@/shared/domains/pgr/job-roles";
import * as repo from "@/shared/db/repositories/job-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isActiveFrom(req: NextRequest): boolean | undefined {
  const value = req.nextUrl.searchParams.get("isActive");
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listJobRoles(tenantId, {
      ...pageParamsFrom(req),
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
      gesId: req.nextUrl.searchParams.get("gesId") ?? undefined,
      isActive: isActiveFrom(req),
      search: req.nextUrl.searchParams.get("search") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = jobRoleInputSchema.parse(await req.json());
      return repo.createJobRole(tenantId, input);
    },
    { status: 201 },
  );
}
