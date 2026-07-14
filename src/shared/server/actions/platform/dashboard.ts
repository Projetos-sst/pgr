"use server";

import * as repo from "@/shared/db/repositories/dashboard";
import type { DashboardSummary } from "@/shared/domains/platform/dashboard";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";

export async function getDashboardSummaryAction(): Promise<
  ActionResult<DashboardSummary>
> {
  return officeAction("platform.dashboard.summary", ({ tenantId }) =>
    repo.getDashboardSummary(tenantId),
  );
}
