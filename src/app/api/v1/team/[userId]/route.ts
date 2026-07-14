import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import {
  removeTeamMember,
  updateTeamMemberRole,
} from "@/shared/server/platform/team-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { userId } = await params;
    return updateTeamMemberRole(ctx, userId, await req.json());
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => {
      const { userId } = await params;
      await removeTeamMember(ctx, userId);
    },
    { status: 204 },
  );
}
