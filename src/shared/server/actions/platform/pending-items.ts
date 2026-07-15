"use server";

import * as repo from "@/shared/db/repositories/pending-items";
import type { PendingItemGroups } from "@/shared/domains/platform/pending-items";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";

export async function getPendingItemsAction(): Promise<ActionResult<PendingItemGroups>> {
  return officeAction("platform.pending.list", ({ tenantId }) =>
    repo.getPendingItems(tenantId),
  );
}
