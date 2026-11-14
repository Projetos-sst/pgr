import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getContract } from "@/shared/server/commercial/commercial-core";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => getContract(ctx, (await params).id));
}
