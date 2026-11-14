import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import {
  getRetentionPolicy,
  recordRetentionPolicyVersion,
} from "@/shared/server/retention/retention-core";

export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => getRetentionPolicy(ctx, pageParamsFrom(req)));
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => {
      const row = await recordRetentionPolicyVersion(ctx, await readJsonBody(req));
      return {
        id: row.id,
        version: row.version,
        status: row.status,
        termsSha256: row.termsSha256,
      };
    },
    { status: 201 },
  );
}
