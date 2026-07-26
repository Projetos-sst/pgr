"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  pgrInputSchema,
  pgrCreateSchema,
  type PgrInput,
  type PgrCreateInput,
  type PgrListItem,
} from "@/shared/domains/pgr/pgr";
import * as repo from "@/shared/db/repositories/pgr";
import { assertPgrEditable, assertPgrPublishable } from "@/shared/server/pgr/pgr-lock";
import type { Pgr } from "@/shared/db/schema/pgr";

const BASE_PATH = "/pgr";

export async function listPgrAction(
  params: repo.ListPgrParams = {},
): Promise<ActionResult<Paginated<PgrListItem>>> {
  return officeAction("pgr.pgr.list", ({ tenantId }) => repo.listPgr(tenantId, params));
}

export async function getPgrAction(id: string): Promise<ActionResult<Pgr>> {
  return officeAction("pgr.pgr.get", async ({ tenantId }) => {
    const row = await repo.getPgrById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createPgrAction(input: PgrCreateInput): Promise<ActionResult<Pgr>> {
  return officeAction(
    "pgr.pgr.create",
    async ({ tenantId }) => {
      const parsed = pgrCreateSchema.parse(input);
      // O aceite é um gate de servidor e NÃO é persistido (a tabela `pgr` não tem coluna).
      const { declarationAccepted: _accepted, ...values } = parsed;
      const row = await repo.createPgr(tenantId, values);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updatePgrAction(
  id: string,
  input: PgrInput,
): Promise<ActionResult<Pgr>> {
  return officeAction(
    "pgr.pgr.update",
    async ({ tenantId }) => {
      const values = pgrInputSchema.parse(input);
      await assertPgrEditable(tenantId, id);
      const row = await repo.updatePgr(tenantId, id, values);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}`);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deletePgrAction(id: string): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.pgr.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deletePgr(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

/** Marca o PGR como publicado e persiste `published_at` no banco (idempotente). */
export async function publishPgrAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.pgr.publish",
    async ({ tenantId }) => {
      await assertPgrPublishable(tenantId, id);
      await repo.publishPgr(tenantId, id);
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}`);
      return { id };
    },
    { audit: true },
  );
}
