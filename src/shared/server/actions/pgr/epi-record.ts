"use server";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  epiRecordQuerySchema,
  type EpiRecordQueryInput,
  type EpiRecordRow,
} from "@/shared/domains/pgr/epi-record";
import type { Paginated } from "@/shared/pagination";
import { getEmployeeEpiRecord } from "@/shared/db/repositories/employee-epi-record";

/**
 * Ficha de EPI do funcionário (US5) — leitura paginada com filtros de
 * status/período. Existe para o uso client-side dos filtros; a page pode
 * consumir o repositório direto no primeiro render.
 */
export async function getEmployeeEpiRecordAction(
  employeeId: string,
  query: EpiRecordQueryInput = {},
): Promise<ActionResult<Paginated<EpiRecordRow>>> {
  return officeAction("epi.record.get", ({ tenantId }) =>
    getEmployeeEpiRecord(tenantId, employeeId, epiRecordQuerySchema.parse(query)),
  );
}
