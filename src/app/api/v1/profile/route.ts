import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getMyProfile, updateMyProfile } from "@/shared/server/platform/profile-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => getMyProfile(ctx));
}

export function PUT(req: NextRequest) {
  return restHandler(req, async (ctx) => updateMyProfile(ctx, await req.json()));
}
