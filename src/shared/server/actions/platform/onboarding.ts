"use server";

import * as dashboardRepo from "@/shared/db/repositories/dashboard";
import {
  deriveOnboardingProgress,
  type OnboardingProgress,
} from "@/shared/domains/platform/onboarding";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";

export async function getOnboardingProgressAction(): Promise<
  ActionResult<OnboardingProgress>
> {
  return officeAction("platform.onboarding.progress", async ({ tenantId }) => {
    const summary = await dashboardRepo.getDashboardSummary(tenantId);
    return deriveOnboardingProgress(summary.kpis);
  });
}
