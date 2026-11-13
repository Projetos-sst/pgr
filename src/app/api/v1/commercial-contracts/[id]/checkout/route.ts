import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(
    req,
    async (ctx) => startContractCheckout(ctx, (await params).id, await readJsonBody(req)),
    { status: 201 },
  );
}
