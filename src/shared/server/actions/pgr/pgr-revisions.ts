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
import { assertPgrEditable } from "@/shared/server/pgr/pgr-lock";

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
      // Schema estrito: `revisionNumber` enviado pelo cliente → VALIDATION/422.
      const values = pgrRevisionInputSchema.parse(input);
      await assertPgrEditable(tenantId, pgrId);
      // O número é calculado no repo (MAX+1 sob lock); o próprio SELECT … FOR UPDATE
      // é o guard de existência/tenant (PGR inexistente/cross-tenant → NOT_FOUND/404).
      const row = await repo.createPgrRevision(tenantId, pgrId, values);
      revalidatePath(editPath(pgrId));
      return row;
    },
    { audit: true },
  );
}

export async function archivePgrRevisionAction(
  pgrId: string,
  revisionId: string,
): Promise<ActionResult<PgrRevision>> {
  return officeAction(
    "pgr.pgr_revisions.archive",
    async ({ tenantId }) => {
      await assertPgrEditable(tenantId, pgrId);
      const row = await repo.archivePgrRevision(tenantId, pgrId, revisionId);
      if (!row) throw new NotFoundError();
      revalidatePath(editPath(pgrId));
      return row;
    },
    { audit: true },
  );
}
