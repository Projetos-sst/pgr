"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  pgrGesInputSchema,
  type PgrGesInput,
  type PgrGesLinkItem,
} from "@/shared/domains/pgr/pgr-ges";
import { getPgrById } from "@/shared/db/repositories/pgr";
import * as repo from "@/shared/db/repositories/pgr-ges";
import { assertPgrEditable } from "@/shared/server/pgr/pgr-lock";

const editPath = (pgrId: string) => `/pgr/${pgrId}`;

export async function listPgrGesAction(
  pgrId: string,
): Promise<ActionResult<PgrGesLinkItem[]>> {
  return officeAction("pgr.pgr_ges.list", async ({ tenantId }) => {
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
    return repo.listPgrGes(tenantId, pgrId);
  });
}

export async function addGesToPgrAction(
  pgrId: string,
  input: PgrGesInput,
): Promise<ActionResult<{ pgrId: string; gesId: string }>> {
  return officeAction(
    "pgr.pgr_ges.add",
    async ({ tenantId }) => {
      await assertPgrEditable(tenantId, pgrId); // vale como guard de existência/tenant
      const { gesId } = pgrGesInputSchema.parse(input);
      await repo.addGesToPgr(tenantId, pgrId, gesId);
      revalidatePath(editPath(pgrId));
      return { pgrId, gesId };
    },
    { audit: true },
  );
}

export async function removeGesFromPgrAction(
  pgrId: string,
  gesId: string,
): Promise<ActionResult<{ gesId: string }>> {
  return officeAction(
    "pgr.pgr_ges.remove",
    async ({ tenantId }) => {
      await assertPgrEditable(tenantId, pgrId);
      const deleted = await repo.removeGesFromPgr(tenantId, pgrId, gesId);
      if (!deleted) throw new NotFoundError();
      revalidatePath(editPath(pgrId));
      return { gesId };
    },
    { audit: true },
  );
}
