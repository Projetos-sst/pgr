import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { inviteTeamMember } from "@/shared/server/platform/team-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) => inviteTeamMember(ctx, await req.json()), {
    status: 201,
  });
}
