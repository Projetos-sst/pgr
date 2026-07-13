"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  pgrRevisionInputSchema,
  type PgrRevision,
  type PgrRevisionInput,
  type PgrRevisionListItem,
} from "@/shared/domains/pgr/pgr-revision";
import { getPgrById } from "@/shared/db/repositories/pgr";
import * as repo from "@/shared/db/repositories/pgr-revisions";

const editPath = (pgrId: string) => `/pgr/${pgrId}`;

export async function listPgrRevisionsAction(
  pgrId: string,
): Promise<ActionResult<PgrRevisionListItem[]>> {
  return officeAction("pgr.pgr_revisions.list", async ({ tenantId }) => {
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
    return repo.listPgrRevisions(tenantId, pgrId);
  });
}

export async function createPgrRevisionAction(
  pgrId: string,
  input: PgrRevisionInput,
): Promise<ActionResult<PgrRevision>> {
  return officeAction(
    "pgr.pgr_revisions.create",
    async ({ tenantId }) => {
      if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
      const values = pgrRevisionInputSchema.parse(input);
      const row = await repo.createPgrRevision(tenantId, pgrId, values);
      revalidatePath(editPath(pgrId));
      return row;
    },
    { audit: true },
  );
}
