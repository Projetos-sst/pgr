"use server";

import { revalidatePath } from "next/cache";

import type {
  AdminSubscriptionDetail,
  AdminSubscriptionRow,
  ReconcileOutcome,
} from "@/shared/domains/commercial/admin-subscriptions";
import * as core from "@/shared/server/commercial/admin-subscriptions-core";
import { masterAction } from "@/shared/server/master-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

export async function listAdminSubscriptionsAction(
  input: unknown,
): Promise<ActionResult<Paginated<AdminSubscriptionRow>>> {
  return masterAction((operator) => core.listAdminSubscriptions(operator, input));
}

export async function getAdminSubscriptionAction(
  orgId: string,
  contractId: string,
): Promise<ActionResult<AdminSubscriptionDetail>> {
  return masterAction((operator) =>
    core.getAdminSubscription(operator, orgId, contractId),
  );
}

export async function reconcileSubscriptionAction(
  input: unknown,
): Promise<ActionResult<ReconcileOutcome>> {
  return masterAction(async (operator) => {
    const outcome = await core.reconcileSubscription(operator, input);
    revalidatePath("/admin-global/subscriptions");
    return outcome;
  });
}
