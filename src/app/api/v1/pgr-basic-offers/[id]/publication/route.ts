import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { publishOffer } from "@/shared/server/pgr/basic-offer-core";
export function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) =>
    publishOffer(ctx, (await params).id, await readJsonBody(req)),
  );
}
