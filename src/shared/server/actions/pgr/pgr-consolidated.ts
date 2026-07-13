"use server";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { PgrConsolidated } from "@/shared/domains/pgr/pgr-consolidated";
import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";

export async function getPgrConsolidatedAction(
  pgrId: string,
): Promise<ActionResult<PgrConsolidated>> {
  return officeAction("pgr.pgr_consolidated.get", async ({ tenantId }) => {
    const data = await getPgrConsolidated(tenantId, pgrId);
    if (!data) throw new NotFoundError();
    return data;
  });
}
