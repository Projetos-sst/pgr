import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as dashboardRepo from "@/shared/db/repositories/dashboard";
import { deriveOnboardingProgress } from "@/shared/domains/platform/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, async ({ tenantId }) => {
    const summary = await dashboardRepo.getDashboardSummary(tenantId);
    return deriveOnboardingProgress(summary.kpis);
  });
}
