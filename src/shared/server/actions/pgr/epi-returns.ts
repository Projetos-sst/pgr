"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  returnCreateSchema,
  type ReturnCreateInput,
  type PendingReturnItem,
  type ReturnResult,
} from "@/shared/domains/pgr/epi-returns";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/epi-returns";

const STOCK_PATH = "/epi-stock";
const RETURNS_PATH = "/epi-returns";

/** Registra a devolução de itens de uma entrega (repõe estoque + carimba returned_at). */
export async function recordReturnAction(
  input: ReturnCreateInput,
): Promise<ActionResult<ReturnResult>> {
  return officeAction(
    "epi.return.record",
    async ({ tenantId }) => {
      const data = returnCreateSchema.parse(input);
      const result = await repo.recordReturn(tenantId, data);
      revalidatePath(STOCK_PATH);
      revalidatePath(RETURNS_PATH);
      return result;
    },
    { audit: true },
  );
}

/** Lista itens pendentes de devolução (returned_at IS NULL em entregas assinadas). */
export async function listPendingReturnsAction(
  params: repo.ListPendingReturnsParams = {},
): Promise<ActionResult<Paginated<PendingReturnItem>>> {
  return officeAction("epi.return.list_pending", ({ tenantId }) =>
    repo.listPendingReturns(tenantId, params),
  );
}
