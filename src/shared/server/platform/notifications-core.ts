import "server-only";

import * as dashboardRepo from "@/shared/db/repositories/dashboard";
import {
  buildNotifications,
  type AppNotification,
} from "@/shared/domains/platform/notifications";

export async function getNotifications(orgId: string): Promise<AppNotification[]> {
  const summary = await dashboardRepo.getDashboardSummary(orgId);
  return buildNotifications(summary.pending);
}
