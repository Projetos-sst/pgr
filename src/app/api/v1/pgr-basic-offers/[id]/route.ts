import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getOffer } from "@/shared/server/pgr/basic-offer-core";
export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => getOffer(ctx, (await params).id));
}
