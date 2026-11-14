"use server";

import { revalidatePath } from "next/cache";

import type { PageParams } from "@/shared/pagination";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/retention/retention-core";
import { listPgrRetentionExports } from "@/shared/server/retention/retention-export-core";

export async function getRetentionPolicyAction(page: PageParams = {}) {
  return officeAction("retention.policy.get", (ctx) =>
    core.getRetentionPolicy(ctx, page),
  );
}

export async function recordRetentionPolicyVersionAction(input: unknown) {
  return officeAction(
    "retention.policy.record",
    async (ctx) => {
      const row = await core.recordRetentionPolicyVersion(ctx, input);
      revalidatePath("/retention");
      return {
        id: row.id,
        version: row.version,
        status: row.status,
        termsSha256: row.termsSha256,
      };
    },
    { audit: true },
  );
}

export async function simulateRetentionAction(input: unknown) {
  return officeAction("retention.policy.simulate", (ctx) =>
    core.simulateRetention(ctx, input),
  );
}

export async function listPgrRetentionExportsAction(
  pgrId: string,
  page: PageParams = {},
) {
  return officeAction("retention.export.list", (ctx) =>
    listPgrRetentionExports(ctx, pgrId, page),
  );
}
