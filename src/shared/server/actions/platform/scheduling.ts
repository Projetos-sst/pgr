"use server";

import { revalidatePath } from "next/cache";

import type { ScheduleEvent } from "@/shared/db/schema";
import * as repo from "@/shared/db/repositories/schedule-events";
import {
  scheduleEventInputSchema,
  type ScheduleEventInput,
  type ScheduleEventListItem,
} from "@/shared/domains/platform/scheduling";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

export async function listScheduleEventsAction(
  params: repo.ListScheduleEventsParams = {},
): Promise<ActionResult<Paginated<ScheduleEventListItem>>> {
  return officeAction("platform.schedule.list", ({ tenantId }) =>
    repo.listScheduleEvents(tenantId, params),
  );
}

export async function getScheduleEventAction(
  id: string,
): Promise<ActionResult<ScheduleEvent>> {
  return officeAction("platform.schedule.get", async ({ tenantId }) => {
    const row = await repo.getScheduleEventById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createScheduleEventAction(
  input: ScheduleEventInput,
): Promise<ActionResult<ScheduleEvent>> {
  return officeAction(
    "platform.schedule.create",
    async ({ tenantId }) => {
      const values = scheduleEventInputSchema.parse(input);
      const row = await repo.createScheduleEvent(tenantId, values);
      revalidatePath("/schedule");
      return row;
    },
    { audit: true },
  );
}

export async function updateScheduleEventAction(
  id: string,
  input: ScheduleEventInput,
): Promise<ActionResult<ScheduleEvent>> {
  return officeAction(
    "platform.schedule.update",
    async ({ tenantId }) => {
      const values = scheduleEventInputSchema.parse(input);
      const row = await repo.updateScheduleEvent(tenantId, id, values);
      if (!row) throw new NotFoundError();
      revalidatePath("/schedule");
      return row;
    },
    { audit: true },
  );
}

export async function deleteScheduleEventAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "platform.schedule.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteScheduleEvent(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath("/schedule");
      return { deleted: true as const };
    },
    { audit: true },
  );
}
