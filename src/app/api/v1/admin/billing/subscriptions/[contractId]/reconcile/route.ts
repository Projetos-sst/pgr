import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { requireMaster } from "@/shared/auth/require-master";
import { reconcileSubscription } from "@/shared/server/commercial/admin-subscriptions-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withContract(body: unknown, contractId: string): unknown {
  return typeof body === "object" && body !== null ? { ...body, contractId } : body;
}

export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  return restHandler(
    req,
    async () => {
      const operator = await requireMaster();
      const body = await readJsonBody(req);
      return reconcileSubscription(
        operator,
        withContract(body, (await params).contractId),
      );
    },
    { tenantAccess: true },
  );
}
