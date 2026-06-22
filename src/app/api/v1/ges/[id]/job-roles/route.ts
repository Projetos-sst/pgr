import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { gesJobRoleInputSchema } from "@/shared/domains/pgr/ges";
import * as linkRepo from "@/shared/db/repositories/ges-job-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    if (req.nextUrl.searchParams.get("available") === "true") {
      return linkRepo.listAvailableJobRolesForGes(tenantId, id);
    }
    return linkRepo.listGesJobRoles(tenantId, { gesId: id });
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const body = (await req.json()) as Record<string, unknown>;
      const input = gesJobRoleInputSchema.parse({ ...body, gesId: id });
      return linkRepo.createGesJobRole(tenantId, input);
    },
    { status: 201 },
  );
}
