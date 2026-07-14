import "server-only";

import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type {
  ScheduleEventListItem,
  ScheduleEventValues,
} from "@/shared/domains/platform/scheduling";
import { toScheduleEventListItem } from "@/shared/domains/platform/scheduling";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { scheduleEvents, type ScheduleEvent } from "../schema";
import { withOrg } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "platform.schedule.write_rejected";

export type ListScheduleEventsParams = PageParams & {
  eventType?: string;
  from?: string;
  to?: string;
};

function toColumns(input: ScheduleEventValues) {
  return {
    eventType: input.eventType,
    title: input.title,
    eventDate: input.eventDate,
    description: input.description ?? null,
    referenceUrl: input.referenceUrl ?? null,
  };
}

export async function listScheduleEvents(
  orgId: string,
  params: ListScheduleEventsParams = {},
): Promise<Paginated<ScheduleEventListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(scheduleEvents.orgId, orgId)];
  if (params.eventType) {
    filters.push(
      eq(scheduleEvents.eventType, params.eventType as ScheduleEvent["eventType"]),
    );
  }
  if (params.from) filters.push(gte(scheduleEvents.eventDate, params.from));
  if (params.to) filters.push(lte(scheduleEvents.eventDate, params.to));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(scheduleEvents)
      .where(where)
      .orderBy(asc(scheduleEvents.eventDate))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(scheduleEvents)
      .where(where);
    return { rows: rows.map(toScheduleEventListItem), total };
  });
}

export async function getScheduleEventById(
  orgId: string,
  id: string,
): Promise<ScheduleEvent | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.orgId, orgId), eq(scheduleEvents.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createScheduleEvent(
  orgId: string,
  input: ScheduleEventValues,
): Promise<ScheduleEvent> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(scheduleEvents)
        .values({ orgId, ...toColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateScheduleEvent(
  orgId: string,
  id: string,
  input: ScheduleEventValues,
): Promise<ScheduleEvent | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(scheduleEvents)
        .set({ ...toColumns(input), updatedAt: new Date() })
        .where(and(eq(scheduleEvents.orgId, orgId), eq(scheduleEvents.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteScheduleEvent(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(scheduleEvents)
        .where(and(eq(scheduleEvents.orgId, orgId), eq(scheduleEvents.id, id)))
        .returning({ id: scheduleEvents.id });
      return rows.length > 0;
    }),
  );
}
