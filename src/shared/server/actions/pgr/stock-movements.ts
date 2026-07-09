"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  stockEntrySchema,
  stockExitSchema,
  type StockEntryInput,
  type StockExitInput,
  type StockMovementResult,
  type StockMovementRow,
} from "@/shared/domains/pgr/stock-movements";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/stock-movements";

const BASE_PATH = "/epi-stock";

function revalidateStock(stockId: string): void {
  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${stockId}/edit`);
  revalidatePath(`${BASE_PATH}/${stockId}/history`);
}

export async function registerStockEntryAction(
  input: StockEntryInput,
): Promise<ActionResult<StockMovementResult>> {
  return officeAction(
    "epi.stock_movement.entry",
    async ({ tenantId }) => {
      const data = stockEntrySchema.parse(input);
      const result = await repo.registerStockEntry(tenantId, data);
      revalidateStock(data.stockId);
      return result;
    },
    { audit: true },
  );
}

export async function registerStockExitAction(
  input: StockExitInput,
): Promise<ActionResult<StockMovementResult>> {
  return officeAction(
    "epi.stock_movement.exit",
    async ({ tenantId }) => {
      const data = stockExitSchema.parse(input);
      const result = await repo.registerStockExit(tenantId, data);
      revalidateStock(data.stockId);
      return result;
    },
    { audit: true },
  );
}

export async function listStockMovementsAction(
  stockId: string,
  params: repo.ListStockMovementsParams = {},
): Promise<ActionResult<Paginated<StockMovementRow>>> {
  return officeAction("epi.stock_movement.list", ({ tenantId }) =>
    repo.listStockMovements(tenantId, stockId, params),
  );
}
