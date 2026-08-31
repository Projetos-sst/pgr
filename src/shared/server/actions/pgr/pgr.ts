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
  type PgrListItemWithCreator,
} from "@/shared/domains/pgr/pgr";
import * as repo from "@/shared/db/repositories/pgr";
import { listMembershipsByOrg } from "@/shared/db/repositories/org-memberships";
import { assertPgrEditable, assertPgrPublishable } from "@/shared/server/pgr/pgr-lock";
import type { Pgr } from "@/shared/db/schema/pgr";

const BASE_PATH = "/pgr";

export async function listPgrAction(
  params: repo.ListPgrParams = {},
): Promise<ActionResult<Paginated<PgrListItemWithCreator>>> {
  return officeAction("pgr.pgr.list", async ({ tenantId }) => {
    const { rows, total } = await repo.listPgr(tenantId, params);
    // Coluna "Usuário": resolve o nome do autor via roster do time (admin client,
    // fora do app_runtime), pois `users` tem RLS própria. Uma consulta por página.
    const creatorIds = new Set(
      rows.map((r) => r.createdBy).filter((id): id is string => Boolean(id)),
    );
    const nameById = new Map<string, string>();
    if (creatorIds.size > 0) {
      // Enriquecimento best-effort: se o roster (admin client) falhar, a coluna
      // "Usuário" degrada para "—" em vez de quebrar a listagem.
      try {
        const roster = await listMembershipsByOrg(tenantId, { pageSize: 1000 });
        for (const m of roster.rows) {
          const name =
            [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || null;
          if (name) nameById.set(m.userId, name);
        }
      } catch {
        // ignora — nomes ficam nulos (coluna "Usuário" mostra "—")
      }
    }
    return {
      rows: rows.map((r) => ({
        ...r,
        createdByName: r.createdBy ? (nameById.get(r.createdBy) ?? null) : null,
      })),
      total,
    };
  });
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
    async ({ tenantId, userId }) => {
      const parsed = pgrCreateSchema.parse(input);
      // O aceite é um gate de servidor e NÃO é persistido (a tabela `pgr` não tem coluna).
      const { declarationAccepted: _accepted, ...values } = parsed;
      const row = await repo.createPgr(tenantId, values, userId);
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
