import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { link, listLinks } from "@/shared/server/medicine/professional-links-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listLinks(ctx, (await context.params).id));
}

export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => link(ctx, (await context.params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
