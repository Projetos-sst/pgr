"use server";
import { officeAction } from "@/shared/server/office-action";
import { getCommercialOverview } from "@/shared/server/platform/commercial-core";
export async function getCommercialOverviewAction(page = 1) {
  return officeAction("billing.overview", (ctx) => getCommercialOverview(ctx, page));
}
