"use server";

import type { AppNotification } from "@/shared/domains/platform/notifications";
import { officeAction } from "@/shared/server/office-action";
import { getNotifications } from "@/shared/server/platform/notifications-core";
import type { ActionResult } from "@/shared/server/result";

export async function listNotificationsAction(): Promise<
  ActionResult<AppNotification[]>
> {
  return officeAction("platform.notifications.list", ({ tenantId }) =>
    getNotifications(tenantId),
  );
}
