import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { listOffers, createOffer } from "@/shared/server/pgr/basic-offer-core";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => listOffers(ctx, pageParamsFrom(req)));
}
export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) => createOffer(ctx, await readJsonBody(req)), {
    status: 201,
  });
}
